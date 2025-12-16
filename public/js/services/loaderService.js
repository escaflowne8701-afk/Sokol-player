// public/js/services/loaderService.js - Unified content loader
async function fetchCategories() {
  try {
    const response = await fetch('/api/categories');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return { live: [], movies: [], series: [] };
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function loadContent(type, group, options = {}) {
  try {
    const cats = await fetchCategories();
    let items = [];
    
    if (group === '⭐ Favorites') {
      items = window.Fav ? window.Fav.all().filter(x => x.type === type) : [];
    } else if (group === 'All') {
      // Load all items of this type
      const allGroups = cats[type] || [];
      const promises = allGroups.map(g => 
        fetch(`/api/items/${type}/${encodeURIComponent(g)}`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      items = results.flat();
    } else {
      const response = await fetch(`/api/items/${type}/${encodeURIComponent(group)}`);
      items = await response.json();
    }
    
    // Apply sorting if specified
    if (options.sortBy === 'name') {
      items.sort((a, b) => (a.tvgName || a.title).localeCompare(b.tvgName || b.title));
    } else if (options.sortBy === 'group') {
      items.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    }
    
    // Apply search filter if provided
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      items = items.filter(item => 
        (item.tvgName || item.title || '').toLowerCase().includes(query) ||
        (item.group || '').toLowerCase().includes(query)
      );
    }
    
    // Limit results if specified
    if (options.limit && items.length > options.limit) {
      items = items.slice(0, options.limit);
    }
    
    return items;
  } catch (error) {
    console.error(`Failed to load ${type} content:`, error);
    return [];
  }
}

// Enhanced favorites with categories
export const EnhancedFav = {
  get all() {
    try {
      return JSON.parse(localStorage.getItem('sokol_favorites') || '[]');
    } catch (e) {
      return [];
    }
  },
  
  save(items) {
    localStorage.setItem('sokol_favorites', JSON.stringify(items));
  },
  
  addWithCategory(item, category = 'default') {
    const all = this.all;
    const existingIndex = all.findIndex(x => x.url === item.url && x.category === category);
    
    if (existingIndex >= 0) {
      all.splice(existingIndex, 1);
    } else {
      all.push({ 
        ...item, 
        category, 
        addedAt: Date.now(),
        type: item.type || 'unknown'
      });
    }
    
    this.save(all);
  },
  
  toggle(item) {
    const all = this.all;
    const existingIndex = all.findIndex(x => x.url === item.url);
    
    if (existingIndex >= 0) {
      all.splice(existingIndex, 1);
    } else {
      all.push({
        ...item,
        addedAt: Date.now(),
        lastPlayed: null
      });
    }
    
    this.save(all);
  },
  
  isFavorite(url) {
    return this.all.some(x => x.url === url);
  },
  
  getByCategory(category) {
    return this.all.filter(x => x.category === category);
  },
  
  getByType(type) {
    return this.all.filter(x => x.type === type);
  },
  
  getRecent(limit = 10) {
    return this.all
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, limit);
  },
  
  markPlayed(url) {
    const all = this.all;
    const item = all.find(x => x.url === url);
    if (item) {
      item.lastPlayed = Date.now();
      this.save(all);
    }
  },
  
  clear() {
    localStorage.removeItem('sokol_favorites');
  }
};