import type {Category} from "../models/Task.js";
import { DEFAULT_CATEGORIES } from "../models/Task.js";
import { StorageService } from "./StorageService.js";


export class CategoryService {
      constructor(private readonly storage: StorageService) {}
     
      async getCategories(): Promise<Category[]> {
        const data = await this.storage.load();
        return data.categories ?? DEFAULT_CATEGORIES.map(c => ({ ...c }));
      }
    
      async getCategoryById(id: string): Promise<Category | null> {
        const cats = await this.getCategories();
        return cats.find(c => c.id === id)
          ?? cats.find(c => c.id === "sonstiges")
          ?? cats[cats.length - 1]
          ?? null;
      }
    
      async createCategory(label: string, color: string): Promise<Category> {
        const data = await this.storage.load();
        if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
        const cat: Category = { id: crypto.randomUUID(), label, color };
        data.categories.push(cat);
        await this.storage.save(data);
        return cat;
      }
    
      async updateCategory(id: string, label: string, color: string): Promise<void> {
        const data = await this.storage.load();
        if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
        const idx = data.categories.findIndex(c => c.id === id);
        if (idx === -1) return;
        data.categories[idx] = { ...data.categories[idx], label, color };
        await this.storage.save(data);
      }
    
      async setCategoryParent(id: string, parentId: string | null): Promise<void> {
        const data = await this.storage.load();
        if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
        const idx = data.categories.findIndex(c => c.id === id);
        if (idx === -1) return;
        const { parentId: _removed, ...rest } = data.categories[idx];
        // parentId wird nur gesetzt wenn != null, damit das Feld nicht als null in Firestore landet
        data.categories[idx] = parentId ? { ...rest, parentId } : rest;
        await this.storage.save(data);
      }
    
      async deleteCategory(id: string): Promise<number> {
        const data = await this.storage.load();
        if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
        const usedCount = data.tasks.filter(t => !t.archived && t.category === id).length;
        if (usedCount > 0) return usedCount;
        data.categories = data.categories.filter(c => c.id !== id);
        await this.storage.save(data);
        return 0;
      }
}