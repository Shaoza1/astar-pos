import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { CreateRecipeDto, IngredientDto, MenuGroupDto, MenuItemDto } from '@astar-pos/shared';

import api from '@/services/api';

interface RecipeLine {
  ingredientId: string;
  quantity: string;
}

export default function MenuManagementPage() {
  const [groups, setGroups] = useState<MenuGroupDto[]>([]);
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [activeGroup, setActiveGroup] = useState('');
  const [editPrice, setEditPrice] = useState<Record<string, string>>({});
  const [recipeModal, setRecipeModal] = useState<MenuItemDto | null>(null);
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);

  async function load() {
    const [{ data: grps }, { data: its }, { data: ings }] = await Promise.all([
      api.get<MenuGroupDto[]>('/menu/groups'),
      api.get<MenuItemDto[]>('/menu/items'),
      api.get<IngredientDto[]>('/inventory/ingredients'),
    ]);
    setGroups(grps);
    setItems(its);
    setIngredients(ings);
    if (grps.length > 0) setActiveGroup(grps[0].id);
  }

  useEffect(() => {
    void load();
  }, []);

  async function savePrice(item: MenuItemDto) {
    const price = parseFloat(editPrice[item.id] ?? '');
    if (isNaN(price)) return;
    try {
      await api.patch(`/menu/items/${item.id}`, { price });
      toast.success('Price updated');
      setEditPrice((prev) => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
      await load();
    } catch {
      toast.error('Failed to update price');
    }
  }

  async function openRecipe(item: MenuItemDto) {
    setRecipeModal(item);
    if (item.recipe) {
      setRecipeLines(
        item.recipe.items.map((r) => ({
          ingredientId: r.ingredientId,
          quantity: String(r.quantity),
        }))
      );
    } else {
      setRecipeLines([{ ingredientId: '', quantity: '' }]);
    }
  }

  async function saveRecipe() {
    if (!recipeModal) return;
    const body: CreateRecipeDto = {
      menuItemId: recipeModal.id,
      items: recipeLines
        .filter((l) => l.ingredientId && l.quantity)
        .map((l) => ({ ingredientId: l.ingredientId, quantity: parseFloat(l.quantity) })),
    };
    try {
      await api.post('/menu/recipes', body);
      toast.success('Recipe saved');
      setRecipeModal(null);
      await load();
    } catch {
      toast.error('Failed to save recipe');
    }
  }

  const visibleItems = items.filter((i) => i.groupId === activeGroup);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4">
      <h1 className="text-xl font-bold text-[var(--color-primary)] mb-4">Menu Management</h1>

      {/* Group tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-4 bg-white rounded-t-2xl">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeGroup === g.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-b-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Price', 'Recipe', 'Active', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  {editPrice[item.id] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editPrice[item.id]}
                        onChange={(e) =>
                          setEditPrice((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-20 border rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => void savePrice(item)}
                        className="text-xs text-[var(--color-success)] font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setEditPrice((prev) => {
                            const n = { ...prev };
                            delete n[item.id];
                            return n;
                          })
                        }
                        className="text-xs text-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setEditPrice((prev) => ({ ...prev, [item.id]: String(item.price) }))
                      }
                      className="font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      R{item.price.toFixed(2)}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.hasRecipe ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Has recipe
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No recipe</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void openRecipe(item)}
                    className="text-xs text-[var(--color-primary)] underline"
                  >
                    Manage Recipe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recipe editor modal */}
      {recipeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Recipe — {recipeModal.name}</h2>
            <div className="space-y-2 mb-4">
              {recipeLines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={line.ingredientId}
                    onChange={(e) => {
                      const next = [...recipeLines];
                      next[i] = { ...next[i], ingredientId: e.target.value };
                      setRecipeLines(next);
                    }}
                    className="flex-1 border rounded-lg px-2 py-2 text-sm"
                  >
                    <option value="">Select ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.consumptionUnit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...recipeLines];
                      next[i] = { ...next[i], quantity: e.target.value };
                      setRecipeLines(next);
                    }}
                    className="w-20 border rounded-lg px-2 py-2 text-sm"
                    placeholder="Qty"
                  />
                  <button
                    onClick={() => setRecipeLines((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[var(--color-danger)] text-lg font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setRecipeLines((prev) => [...prev, { ingredientId: '', quantity: '' }])
              }
              className="text-sm text-[var(--color-primary)] underline mb-4"
            >
              + Add ingredient
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setRecipeModal(null)}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveRecipe()}
                className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
