// public/js/app.js - Shared utilities for all pages

// HTML escaping function
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Fetch categories from server
async function fetchCategories() {
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return { live: [], movies: [], series: [] };
  }
}

// Debounce function for search inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Show loading indicator
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'block';
  }
}

// Hide loading indicator
function hideLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'none';
  }
}

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Get URL parameter
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Make functions globally available
window.escapeHtml = escapeHtml;
window.fetchCategories = fetchCategories;
window.debounce = debounce;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.formatNumber = formatNumber;
window.getUrlParam = getUrlParam;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Sokol Player app.js loaded');
  
  // Add loading state to all play buttons
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('play-btn') || e.target.closest('.play-btn')) {
      const btn = e.target.classList.contains('play-btn') ? e.target : e.target.closest('.play-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="loading-spinner"></span> Loading...';
      btn.disabled = true;
      
      // Reset after 10 seconds if still disabled
      setTimeout(() => {
        if (btn.disabled) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      }, 10000);
    }
  });
});