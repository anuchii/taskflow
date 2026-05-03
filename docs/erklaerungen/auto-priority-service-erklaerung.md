# Theorie: Automatische Priorisierung — Konzept & Architektur

---

## 1. Was ist das Problem?

Ein Task-Manager zeigt dir alle Aufgaben an, aber das menschliche Gehirn ist gut darin, Dringlichkeit zu ignorieren, wenn sie nicht explizit hervorgehoben wird. Eine Aufgabe, die morgen fällig ist, sieht im Interface genauso aus wie eine, die in drei Wochen fällig ist — es sei denn, das System hebt sie hervor.

Die klassische Lösung: **Automatische Eskalation der Priorität** basierend auf zeitlichen Regeln. Das System übernimmt die Aufmerksamkeitssteuerung, die der User vergessen hat.

---

## 2. Zwei Kernregeln — Warum gerade diese?

### Regel 1: Fälligkeitsdatum ist morgen → `high`

**Warum "morgen" und nicht "heute"?**  
Wenn eine Aufgabe *heute* fällig ist, ist es zu spät zum Priorisieren — du musst sie einfach erledigen. Die interessante Intervention passiert *einen Tag vorher*: genug Zeit, um umzuplanen, Ressourcen freizuschaufeln oder zu delegieren.

Das Konzept stammt aus dem **Zeitmanagement** (GTD, Getting Things Done): Ein "Tomorrow-Warning" gibt dir genau das richtige Zeitfenster, um noch reagieren zu können.

### Regel 2: Mehr als 2 Tage überfällig → `high`

**Warum 2 Tage und nicht sofort bei Überfälligkeit?**  
Ein Tag Überfälligkeit kann viele harmlose Gründe haben: Wochenende, Krankheit, Verschiebung. Ab Tag 3 ist die Aufgabe systemisch vernachlässigt — das Signal wird wichtiger.

Die 2-Tage-Schwelle verhindert **Alarm-Fatigue**: Wenn jede Aufgabe, die einen Tag zu spät ist, sofort rot aufleuchtet, gewöhnt sich der User daran und ignoriert alle Warnungen.

---

## 3. Das `isAutoPrioritized`-Flag — Warum ist es nötig?

Ohne das Flag hätten wir ein **Zuordnungsproblem**: Wer hat die Priorität gesetzt — der User oder das System?

```
Task A: priority = "high"   → User-Entscheidung oder Auto-Eskalation?
Task B: priority = "high"   → Gleiche Frage, keine Antwort im Datenmodell
```

Das ist nicht nur ein UX-Problem. Es ist ein **Datenintegrätsproblem**: Beim nächsten `runAutoPrioritization()`-Lauf würde das System eine User-gesetzte Priorität mit dem System-Flag überschreiben, obwohl der User eine bewusste Entscheidung getroffen hat.

Das Flag löst das:

```
Task A: priority = "high", isAutoPrioritized = undefined  → User-Entscheidung → kein ⚡
Task B: priority = "high", isAutoPrioritized = true        → System-Entscheidung → ⚡
```

**In Angular:** Das Flag wäre Teil des Domain-Modells und könnte direkt in Templates genutzt werden:
```html
@if (task.isAutoPrioritized) {
  <span class="auto-priority-icon">⚡</span>
}
```

---

## 4. Warum eine eigene Serviceklasse und keine Methode im TaskService?

**Single Responsibility Principle (SRP):** Jede Klasse hat genau eine Verantwortung.

- `TaskService`: Verwaltet Tasks in der Datenbank (laden, speichern, abfragen)
- `AutoPriorityService`: Berechnet, welche Tasks priorisiert werden sollen

Wenn die Prioritätslogik wächst (z. B. neue Regeln wie "Aufgabe mit hohem Zeitaufwand und enger Deadline"), ändert sich nur `AutoPriorityService`. Der `TaskService` bleibt unberührt.

**Testbarkeit:** `AutoPriorityService.computeChanges()` ist eine **pure Funktion**:
- Kein `await`
- Keine Firestore-Aufrufe
- Keine globalen Variablen
- Gleiche Eingabe → immer gleiche Ausgabe

Das macht sie direkt unit-testbar, ohne Mocks:

```typescript
const service = new AutoPriorityService();
const result = service.computeChanges(mockTasks, mockCompletions);
expect(result).toHaveLength(1);
expect(result[0].patch.priority).toBe("high");
```

**In Angular:** Der Service würde einfach `@Injectable({ providedIn: 'root' })` erhalten und könnte per Dependency Injection überall genutzt werden:

```typescript
@Injectable({ providedIn: 'root' })
export class AutoPriorityService {
  computeChanges(tasks: Task[], completions: CompletionLog[]): AutoPriorityChange[] { ... }
}
```

---

## 5. Datumsprüfung — Wie funktioniert sie technisch?

### ISO-Strings als Date-Keys

Alle Datumsangaben im Projekt sind ISO-8601-Strings im Format `YYYY-MM-DD` (z. B. `"2026-05-04"`). Das ist bewusst gewählt, weil Strings in diesem Format **lexikografisch** vergleichbar sind:

```typescript
"2026-05-04" < "2026-05-10"  // true — string comparison, kein Date-Objekt nötig
"2026-05-04" === "2026-05-04" // true — exakter Vergleich für "same day"
```

Die "morgen"-Prüfung ist damit trivial:
```typescript
task.dueDate === addDays(today(), 1)
```

`addDays()` in `DateUtils.ts` addiert Tage auf einen ISO-String und gibt wieder einen ISO-String zurück — keine Zeitzonen-Probleme, weil wir immer mit `T00:00:00` (Ortszeit) parsen.

### Überfälligkeitstage berechnen

```typescript
Math.round(
  (parseDate(todayStr).getTime() - parseDate(task.dueDate).getTime()) / 86_400_000
)
```

- `parseDate(str)` gibt `new Date(str + "T00:00:00")` zurück → Ortszeit, keine UTC-Verschiebung
- `.getTime()` gibt Millisekunden seit Unix-Epoch zurück
- Differenz / 86.400.000 (= ms pro Tag) = Tage
- `Math.round()` statt `Math.floor()`: Halbzeit-Stunden (Sommerzeit-Wechsel) werden korrekt gerundet

---

## 6. Warum wird die Logik bei jedem Render ausgeführt?

**Das Problem mit einmaliger Ausführung:**  
Wenn `runAutoPrioritization()` nur beim App-Start läuft, aber der User die App tagelang offen lässt (Single-Page-App!), verpassen neue Aufgaben die automatische Hochstufung, bis die App neu geladen wird.

**Die Lösung:** Jedes Mal wenn der User zur Todo-Ansicht navigiert (= `TodoView.render()` wird aufgerufen), prüft das System die Prioritäten neu.

```
User navigiert zu "Aufgaben" 
  → render() 
  → runAutoPrioritization() 
  → computeChanges() 
  → 0 Änderungen? → return (kein Firestore-Write!)
  → ≥ 1 Änderung?  → save() → frische Daten laden → Render
```

Der **Early-Return** bei `changes.length === 0` ist entscheidend: In den meisten Renders gibt es nichts zu tun. Ohne diesen Check würde jeder Navigationsvorgang einen Firestore-Schreibvorgang auslösen — das wäre teuer (Firestore billing) und langsam.

**In Angular:** Derselbe Aufruf würde in `ngOnInit()` des `TodoComponent` stehen:

```typescript
export class TodoComponent implements OnInit {
  constructor(private taskService: TaskService) {}

  async ngOnInit(): Promise<void> {
    await this.taskService.runAutoPrioritization();
    // dann Tasks laden...
  }
}
```

---

## 7. Das Flag-Reset-Problem — Warum wird `isAutoPrioritized: false` beim Speichern gesetzt?

Stell dir vor, eine Aufgabe wird automatisch auf `high` gesetzt mit `isAutoPrioritized: true`. Der User ändert das Fälligkeitsdatum auf übermorgen und speichert.

Ohne Flag-Reset:
1. `updateTask()` schreibt `{ dueDate: "2026-05-06" }` — `isAutoPrioritized` bleibt `true`
2. `runAutoPrioritization()` prüft: `dueDate === tomorrow`? Nein. Überfällig > 2 Tage? Nein.
3. Kein Change → `isAutoPrioritized` bleibt `true` in der DB
4. ⚡ erscheint weiter — obwohl die Bedingung nicht mehr gilt

Mit Flag-Reset in `TaskFormModal.save()`:
1. `updateTask()` schreibt `{ dueDate: "2026-05-06", isAutoPrioritized: false }`
2. `runAutoPrioritization()` findet keine Änderungen
3. ⚡ verschwindet ✓

Der Reset im Form-Modal ist damit die **einzige Stelle**, an der `isAutoPrioritized` bewusst auf `false` gesetzt wird. Überall sonst ist es entweder `undefined` (neuer Task) oder `true` (System-Logik).

---

## 8. Zusammenfassung — Das Muster in Angular

Dieses Feature zeigt ein Muster, das in Angular sehr verbreitet ist:

```
AngularService (AutoPriorityService)
  ↓ computeChanges() — pure Logik
AngularService (TaskService)
  ↓ runAutoPrioritization() — Orchestrierung
AngularComponent (TodoComponent)
  ↓ ngOnInit() — Trigger
Template (todo.component.html)
  ↓ @if(task.isAutoPrioritized) — View
```

Jede Schicht hat exakt eine Aufgabe. Die Logik ist in der untersten Schicht (pure Service), die Daten-Orchestrierung in der mittleren (orchestrierender Service), der Trigger in der Komponente, die Darstellung im Template. Kein Layer muss wissen, was der andere intern tut.
