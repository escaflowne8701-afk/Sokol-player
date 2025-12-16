// public/js/favorites.js - Enhanced Version
const Fav = {
  key: 'sokol_favorites',
  
  all() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch (e) {
      console.error('Error reading favorites:', e);
      return [];
    }
  },
  
  save(a) {
    try {
      localStorage.setItem(this.key, JSON.stringify(a));
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  },
  
  toggle(item) {
    const a = this.all();
    const i = a.findIndex(x => x.url === item.url);
    if (i >= 0) {
      a.splice(i, 1);
    } else {
      // Add with timestamp
      a.push({
        ...item,
        addedAt: Date.now(),
        lastPlayed: null,
        type: item.type || 'unknown'
      });
    }
    this.save(a);
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('favorites-changed', { 
      detail: { action: i >= 0 ? 'removed' : 'added', item }
    }));
  },
  
  is(url) {
    return this.all().some(x => x.url === url);
  },
  
  // New methods
  markPlayed(url) {
    const a = this.all();
    const item = a.find(x => x.url === url);
    if (item) {
      item.lastPlayed = Date.now();
      item.playCount = (item.playCount || 0) + 1;
      this.save(a);
    }
  },
  
  getRecent(limit = 10) {
    return this.all()
      .filter(x => x.lastPlayed)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, limit);
  },
  
  getByType(type) {
    return this.all().filter(x => x.type === type);
  },
  
  getMostPlayed(limit = 10) {
    return this.all()
      .filter(x => x.playCount && x.playCount > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  },
  
  addWithMetadata(url, title, type, metadata = {}) {
    const item = {
      url,
      title,
      type,
      addedAt: Date.now(),
      ...metadata
    };
    
    const a = this.all();
    const existingIndex = a.findIndex(x => x.url === url);
    if (existingIndex >= 0) {
      // Update existing
      a[existingIndex] = { ...a[existingIndex], ...item };
    } else {
      a.push(item);
    }
    this.save(a);
  },
  
  removeByUrl(url) {
    const a = this.all();
    const filtered = a.filter(x => x.url !== url);
    if (filtered.length !== a.length) {
      this.save(filtered);
      return true;
    }
    return false;
  },
  
  clear() {
    localStorage.removeItem(this.key);
    window.dispatchEvent(new Event('favorites-cleared'));
  },
  
  export() {
    return JSON.stringify(this.all(), null, 2);
  },
  
  import(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data)) {
        this.save(data);
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  },
  
  // Get favorites grouped by type
  getGrouped() {
    const all = this.all();
    const grouped = {
      live: [],
      movies: [],
      series: [],
      other: []
    };
    
    all.forEach(item => {
      if (grouped[item.type]) {
        grouped[item.type].push(item);
      } else {
        grouped.other.push(item);
      }
    });
    
    return grouped;
  }
};

// Make globally available
window.Fav = Fav;

// Listen for changes and update UI
window.addEventListener('favorites-changed', (event) => {
  // This can be used by other components to refresh UI
  console.log('Favorites changed:', event.detail);
});