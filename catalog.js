// Complete Google Drive Image Integration System with PERSISTENT CACHING
class DriveImageManager {
  constructor() {
    this.imageCache = new Map();
    this.folderCache = new Map();
    this.isInitialized = false;
    this.cacheVersion = '1.0';
    this.cacheExpiryHours = 24; // Cache expires after 24 hours
    
    // Your specific folder IDs from Google Drive
    this.folders = {
      'Ikhaya/OzzSA': '1tG66zQTXGR-BQwjYZheRHVQ7s4n6-Jan'
    };
  }

  // Initialize Google Drive API
  async initializeGAPI() {
    if (this.isInitialized) return true;
    
    try {
      // Load Google APIs
      await this.loadScript('https://apis.google.com/js/api.js');
      await new Promise(resolve => gapi.load('client', resolve));
      
      await gapi.client.init({
        apiKey: 'AIzaSyDHKDrY2UUT9_HZhBY6GMAkyHYHIdv7OsA', // Replace with your secure API key
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
      });
      
      this.isInitialized = true;
      console.log('✅ Google Drive API initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error);
      return false;
    }
  }

  // Load script helper
  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // PERSISTENT CACHE MANAGEMENT
  getCacheKey(type) {
    return `ozz_catalog_${type}_v${this.cacheVersion}`;
  }

  loadCacheFromStorage() {
    try {
      console.log('🔍 Checking for cached image data...');
      
      // Load cache metadata
      const cacheMetaKey = this.getCacheKey('meta');
      const cacheMetaStr = localStorage.getItem(cacheMetaKey);
      
      if (!cacheMetaStr) {
        console.log('📝 No cache found, will perform full scan');
        return false;
      }
      
      const cacheMeta = JSON.parse(cacheMetaStr);
      const cacheAge = Date.now() - cacheMeta.timestamp;
      const maxAge = this.cacheExpiryHours * 60 * 60 * 1000;
      
      if (cacheAge > maxAge) {
        console.log(`⏰ Cache expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old), will refresh`);
        this.clearCache();
        return false;
      }
      
      // Load folder cache
      const folderCacheKey = this.getCacheKey('folders');
      const folderCacheStr = localStorage.getItem(folderCacheKey);
      
      // Load image cache
      const imageCacheKey = this.getCacheKey('images');
      const imageCacheStr = localStorage.getItem(imageCacheKey);
      
      if (!folderCacheStr || !imageCacheStr) {
        console.log('📝 Incomplete cache found, will perform full scan');
        return false;
      }
      
      // Restore caches
      const folderData = JSON.parse(folderCacheStr);
      const imageData = JSON.parse(imageCacheStr);
      
      // Convert back to Maps
      this.folderCache = new Map(Object.entries(folderData));
      this.imageCache = new Map(Object.entries(imageData));
      
      console.log(`✅ Cache loaded successfully! ${this.imageCache.size} images cached`);
      console.log(`📊 Cache age: ${Math.round(cacheAge / (60 * 1000))} minutes`);
      
      return true;
    } catch (error) {
      console.error('❌ Error loading cache:', error);
      this.clearCache();
      return false;
    }
  }

  saveCacheToStorage() {
    try {
      console.log('💾 Saving image cache to storage...');
      
      // Save cache metadata
      const cacheMeta = {
        timestamp: Date.now(),
        version: this.cacheVersion,
        totalImages: this.imageCache.size,
        folders: Object.keys(this.folders).length
      };
      
      const cacheMetaKey = this.getCacheKey('meta');
      localStorage.setItem(cacheMetaKey, JSON.stringify(cacheMeta));
      
      // Convert Maps to objects for storage
      const folderData = Object.fromEntries(this.folderCache);
      const imageData = Object.fromEntries(this.imageCache);
      
      // Save folder cache
      const folderCacheKey = this.getCacheKey('folders');
      localStorage.setItem(folderCacheKey, JSON.stringify(folderData));
      
      // Save image cache
      const imageCacheKey = this.getCacheKey('images');
      localStorage.setItem(imageCacheKey, JSON.stringify(imageData));
      
      console.log(`✅ Cache saved successfully! ${this.imageCache.size} images cached`);
    } catch (error) {
      console.error('❌ Error saving cache:', error);
      // Clear cache if we can't save (storage might be full)
      this.clearCache();
    }
  }

  clearCache() {
    try {
      const keys = ['meta', 'folders', 'images'];
      keys.forEach(key => {
        localStorage.removeItem(this.getCacheKey(key));
      });
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Check if we need to refresh cache (for future use)
  async checkForUpdates() {
    // This could be enhanced to check if folder modification dates have changed
    // For now, we rely on cache expiry time
    return false;
  }

  // Scan all folders for images with caching
  async scanAllFolders(forceRefresh = false) {
    // Try to load from cache first
    if (!forceRefresh && this.loadCacheFromStorage()) {
      console.log('🚀 Using cached image data, skipping scan');
      return;
    }
    
    console.log('🔍 Scanning Google Drive folders for images...');
    
    for (const [folderName, folderId] of Object.entries(this.folders)) {
      try {
        const images = await this.scanFolderForImages(folderId);
        this.folderCache.set(folderName, images);
        console.log(`📁 ${folderName}: Found ${images.length} images`);
      } catch (error) {
        console.error(`❌ Error scanning folder ${folderName}:`, error);
      }
    }
    
    // Build product code to image mapping
    this.buildImageMapping();
    
    // Save to cache
    this.saveCacheToStorage();
    
    console.log(`🎯 Total images cached: ${this.imageCache.size}`);
  }

  // Scan a specific folder for images
  async scanFolderForImages(folderId, pageToken = null) {
    try {
      const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and (mimeType contains 'image/jpeg' or mimeType contains 'image/png' or mimeType contains 'image/gif' or mimeType contains 'image/webp')`,
        fields: 'nextPageToken, files(id, name, mimeType, parents, webViewLink, thumbnailLink)',
        pageSize: 100,
        pageToken: pageToken
      });

      let files = response.result.files || [];
      
      // If there are more pages, fetch them recursively
      if (response.result.nextPageToken) {
        const nextPageFiles = await this.scanFolderForImages(folderId, response.result.nextPageToken);
        files = files.concat(nextPageFiles);
      }
      
      return files;
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      return [];
    }
  }

  // Build mapping from product codes to images
  buildImageMapping() {
    // Clear existing cache
    this.imageCache.clear();
    
    // Iterate through all cached folders
    for (const [folderName, images] of this.folderCache.entries()) {
      images.forEach(image => {
        // Extract potential product codes from filename
        const codes = this.extractProductCodes(image.name);
        
        codes.forEach(code => {
          if (!this.imageCache.has(code)) {
            this.imageCache.set(code, {
              id: image.id,
              name: image.name,
              thumbnailLink: image.thumbnailLink,
              webViewLink: image.webViewLink,
              directLink: this.getDirectImageUrl(image.id),
              folder: folderName,
              mimeType: image.mimeType
            });
          }
        });
      });
    }
  }

  // Extract product codes from filename
  extractProductCodes(filename) {
    const codes = [];
    
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    
    // Strategy 1: Find exact numeric codes (like "30410", "448217")
    const numericCodes = nameWithoutExt.match(/\b\d{4,6}\b/g);
    if (numericCodes) {
      codes.push(...numericCodes);
    }
    
    // Strategy 2: Find alphanumeric codes (like "22942", "319539")
    const alphanumericCodes = nameWithoutExt.match(/\b[A-Z0-9]{4,8}\b/gi);
    if (alphanumericCodes) {
      codes.push(...alphanumericCodes.map(code => code.toLowerCase()));
    }
    
    // Strategy 3: Split by common delimiters and filter
    const parts = nameWithoutExt.split(/[-_\s\.]+/);
    parts.forEach(part => {
      const cleanPart = part.trim();
      if (/^\d{4,6}$/.test(cleanPart) || /^[A-Z0-9]{4,8}$/i.test(cleanPart)) {
        codes.push(cleanPart.toLowerCase());
      }
    });
    
    // Remove duplicates and return
    return [...new Set(codes)];
  }

  // Get direct image URL for embedding - uses Google CDN
  getDirectImageUrl(fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w800-h800-c`;
  }

  // Get image for a specific product code
  getProductImage(productCode) {
    const normalizedCode = productCode.toString().toLowerCase().trim();
    const imageData = this.imageCache.get(normalizedCode);
    
    if (imageData) {
      return {
        url: imageData.directLink,
        thumbnail: imageData.thumbnailLink,
        name: imageData.name,
        found: true
      };
    }
    
    return {
      url: null,
      thumbnail: null,
      name: null,
      found: false
    };
  }

  // Get stats about image mapping
  getStats() {
    const folderStats = {};
    for (const [folderName, images] of this.folderCache.entries()) {
      folderStats[folderName] = images.length;
    }
    
    // Get cache info
    const cacheMetaKey = this.getCacheKey('meta');
    const cacheMetaStr = localStorage.getItem(cacheMetaKey);
    let cacheInfo = null;
    
    if (cacheMetaStr) {
      try {
        const cacheMeta = JSON.parse(cacheMetaStr);
        const cacheAge = Date.now() - cacheMeta.timestamp;
        cacheInfo = {
          age: Math.round(cacheAge / (60 * 1000)), // minutes
          timestamp: new Date(cacheMeta.timestamp).toLocaleString()
        };
      } catch (error) {
        console.warn('Could not parse cache metadata');
      }
    }
    
    return {
      totalImages: Array.from(this.folderCache.values()).reduce((sum, images) => sum + images.length, 0),
      mappedProducts: this.imageCache.size,
      folderStats: folderStats,
      cacheInfo: cacheInfo
    };
  }

  // Force refresh cache (useful for manual refresh)
  async forceRefresh() {
    console.log('🔄 Forcing cache refresh...');
    this.clearCache();
    await this.scanAllFolders(true);
  }
}

// Enhanced image URL function for your catalog
const createEnhancedImageSystem = () => {
  const driveManager = new DriveImageManager();
  let isSystemReady = false;
  
  // Initialize the system with caching
  const initializeImageSystem = async () => {
    try {
      const success = await driveManager.initializeGAPI();
      if (success) {
        await driveManager.scanAllFolders(); // This will use cache if available
        isSystemReady = true;
        
        // Show stats
        const stats = driveManager.getStats();
        console.log('📊 Image System Stats:', stats);
        
        if (stats.cacheInfo) {
          console.log(`💾 Cache status: ${stats.cacheInfo.age} minutes old (${stats.cacheInfo.timestamp})`);
        }
        
        // Trigger re-render if images are found
        if (stats.mappedProducts > 0) {
          console.log(`🎉 Successfully mapped ${stats.mappedProducts} product images!`);
        }
      }
    } catch (error) {
      console.error('Failed to initialize image system:', error);
    }
  };
  
  // Enhanced image URL function
  const getImageUrl = (category, code) => {
    if (!isSystemReady) {
      // Return placeholder while system initializes
      return generatePlaceholderSVG(category, code, 'Loading Cache...');
    }
    
    const imageData = driveManager.getProductImage(code);
    
    if (imageData.found) {
      return imageData.url;
    }
    
    // Fallback to placeholder
    return generatePlaceholderSVG(category, code, 'No image found');
  };
  
  // Generate placeholder SVG
  const generatePlaceholderSVG = (category, code, message = 'Loading...') => {
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad${code.replace(/[^a-zA-Z0-9]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f0f9ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#dbeafe;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#grad${code.replace(/[^a-zA-Z0-9]/g, '')})" stroke="#3b82f6" stroke-width="2"/>
        <text x="100" y="60" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16" font-weight="bold" fill="#1e40af">
          ${code}
        </text>
        <text x="100" y="85" text-anchor="middle" dy=".3em" font-family="Arial" font-size="10" fill="#64748b">
          ${category}
        </text>
        <circle cx="100" cy="110" r="12" fill="${message.includes('Loading') || message.includes('Cache') ? '#f59e0b' : '#10b981'}" />
        <text x="100" y="114" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="white">${message.includes('Loading') || message.includes('Cache') ? '💾' : '📱'}</text>
        <text x="100" y="135" text-anchor="middle" dy=".3em" font-family="Arial" font-size="9" fill="${message.includes('Loading') || message.includes('Cache') ? '#f59e0b' : '#10b981'}" font-weight="bold">
          ${message.toUpperCase()}
        </text>
        <text x="100" y="155" text-anchor="middle" dy=".3em" font-family="Arial" font-size="8" fill="#6b7280">
          OZZ Catalog
        </text>
      </svg>
    `)}`;
  };
  
  return {
    initializeImageSystem,
    getImageUrl,
    getStats: () => driveManager.getStats(),
    isReady: () => isSystemReady,
    driveManager,
    forceRefresh: () => driveManager.forceRefresh() // Add manual refresh capability
  };
};

// MAIN CATALOG COMPONENT - UPDATED VERSION WITH PERSISTENT CACHING
const { useState, useEffect, useMemo } = React;

const OzzCatalog = () => {
  // State management
  const [currentView, setCurrentView] = useState('categories');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [quote, setQuote] = useState([]);
  const [showQuote, setShowQuote] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productData, setProductData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [screenSize, setScreenSize] = useState('mobile');
  
  // Image system state
  const [imageSystemReady, setImageSystemReady] = useState(false);
  const [imageStats, setImageStats] = useState(null);

  // Initialize the image system
  const imageSystem = useMemo(() => createEnhancedImageSystem(), []);

  // Enhanced Image Container Component (Level 2)
  const EnhancedImageContainer = ({ product, selectedCategory, setSelectedProduct }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [fitMode, setFitMode] = useState('contain'); // 'contain' or 'cover'

    return (
      <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden group">
        <img
          src={imageSystem.getImageUrl(selectedCategory, product.code)}
          alt={product.description}
          className={`w-full h-full transition-all duration-300 ${
            fitMode === 'cover' ? 'group-hover:scale-105' : ''
          } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            objectFit: fitMode,
            objectPosition: 'center',
            transform: fitMode === 'contain' ? 'scale(1.15)' : undefined,
            transformOrigin: 'center center',
          }}
          loading="lazy"
          onLoad={(e) => {
            if (!e.target.src.includes('data:image/svg+xml')) {
              setImageLoaded(true);
              console.log(`✅ Image loaded successfully for product ${product.code}`);
            }
          }}
          onError={(e) => {
            console.warn(`❌ Failed to load image for product ${product.code}`);
          }}
        />
        
        {/* Loading Animation */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* Loading overlay during system initialization */}
        {!imageSystemReady && (
          <div className="absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center">
            <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded shadow">
              Loading Cache...
            </div>
          </div>
        )}
        
        {/* Fit Toggle Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFitMode(fitMode === 'cover' ? 'contain' : 'cover');
          }}
          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70"
          title={fitMode === 'contain' ? 'Crop to fill frame' : 'Show full image'}
        >
          {fitMode === 'contain' ? '📐' : '🔍'}
        </button>
        
        {/* Stock Badge */}
        {product.soh && (
          <div className="absolute top-1 sm:top-2 left-1 sm:left-2 bg-green-500 text-white text-xs px-1 sm:px-2 py-1 rounded-full font-medium shadow-sm z-10">
            SOH: {product.soh}
          </div>
        )}
      </div>
    );
  };

  // Detect screen size and orientation
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      if (width < 480) {
        setScreenSize('mobile');
      } else if (width < 768) {
        setScreenSize('mobile-large');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateScreenSize, 100);
    });
    
    return () => {
      window.removeEventListener('resize', updateScreenSize);
      window.removeEventListener('orientationchange', updateScreenSize);
    };
  }, []);

  // Load Excel data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!window.XLSX) {
          console.log('Loading XLSX library...');
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        console.log('Fetching Excel file...');
        const response = await fetch('Ozz list.xlsx');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = window.XLSX.read(arrayBuffer);

        console.log('Processing Excel data...');
        const data = {};
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { raw: false });
          
          data[sheetName] = jsonData.map(item => {
            const product = {
              code: item.Code?.toString().trim(),
              description: item.Description?.trim()
            };
            
            if (sheetName === 'Otima ref') {
              product.supplierRef = item['Supp/Ref']?.trim();
              product.soh = item.Soh?.toString().trim();
            }
            
            return product;
          }).filter(product => product.code && product.description);
        });
        
        setProductData(data);
        setIsLoading(false);
        console.log('✅ Catalog loaded successfully:', Object.keys(data).length, 'categories');
      } catch (error) {
        console.error('❌ Error loading Excel data:', error);
        setIsLoading(false);
        
        // Fallback data
        const fallbackData = {
          'Glassware': [
            { code: '30410', description: 'MUG COFFEE PICCO 6\'S C/NOVA' },
            { code: '30709', description: 'TUMBLER WHISKY 6\'S MOZ C/NOVA' },
            { code: '32002', description: 'TUMBLER JUICE 6\'S LOV C/NOVA' }
          ],
          'Plastic': [
            { code: '448217', description: 'BASIN 32CM COLOUR IKHAYA' },
            { code: '444442', description: 'BASIN 38CM COLOUR IKHAYA' },
            { code: '451737', description: 'BASIN 46CM 12 SIDED IKHAYA' }
          ],
          'Stainless Steel': [
            { code: '445902', description: 'BOWL S/S GERMAN 14CM IKHAYA' },
            { code: '442576', description: 'BOWL S/S GERMAN 16CM IKHAYA' }
          ],
          'Hardware': [
            { code: '319539', description: '2 WAY TAPE 2PCE ROLL' },
            { code: '22942', description: 'BARRIER TAPE 100MT 53001' }
          ]
        };
        
        setProductData(fallbackData);
        console.log('📊 Using fallback data for testing');
      }
    };
    
    loadData();
  }, []);

  // Initialize Google Drive image system
  useEffect(() => {
    const initImages = async () => {
      if (!isLoading && Object.keys(productData).length > 0 && !imageSystemReady) {
        console.log('🚀 Initializing Google Drive image system...');
        
        try {
          await imageSystem.initializeImageSystem();
          const stats = imageSystem.getStats();
          setImageStats(stats);
          setImageSystemReady(true);
          
          console.log('✅ Image system ready!', stats);
          
          if (stats.mappedProducts > 0) {
            console.log(`🎉 Found ${stats.mappedProducts} product images in Google Drive!`);
          }
        } catch (error) {
          console.error('❌ Image system initialization failed:', error);
          setImageSystemReady(true);
        }
      }
    };
    
    initImages();
  }, [isLoading, productData, imageSystemReady, imageSystem]);

  // Category configuration
  const categoryConfig = {
    'Otima ref': { icon: '🎉', color: 'bg-purple-100 border-purple-300' },
    'Glassware': { icon: '🥃', color: 'bg-blue-100 border-blue-300' },
    'Stoneware': { icon: '🍽️', color: 'bg-orange-100 border-orange-300' },
    'Plastic': { icon: '🥤', color: 'bg-green-100 border-green-300' },
    'Stainless Steel': { icon: '🥄', color: 'bg-gray-100 border-gray-300' },
    'Catering': { icon: '🍴', color: 'bg-yellow-100 border-yellow-300' },
    'Cutlery': { icon: '🔪', color: 'bg-red-100 border-red-300' },
    'Bakeware': { icon: '🧁', color: 'bg-pink-100 border-pink-300' },
    'Packaging': { icon: '📦', color: 'bg-indigo-100 border-indigo-300' },
    'Toys': { icon: '🎾', color: 'bg-teal-100 border-teal-300' },
    'Brushware': { icon: '🧹', color: 'bg-cyan-100 border-cyan-300' },
    'Outdoor': { icon: '🔥', color: 'bg-emerald-100 border-emerald-300' },
    'Hardware': { icon: '🔧', color: 'bg-stone-100 border-stone-300' }
  };

  // Responsive grid configuration
  const getGridConfig = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;
    
    let categoryGrid, productGrid;
    
    if (width < 480) {
      categoryGrid = isLandscape ? 'grid-cols-4 gap-2' : 'grid-cols-2 gap-3';
      productGrid = isLandscape ? 'grid-cols-4 gap-2' : 'grid-cols-2 gap-3';
    } else if (width < 768) {
      categoryGrid = isLandscape ? 'grid-cols-5 gap-3' : 'grid-cols-2 gap-4';
      productGrid = isLandscape ? 'grid-cols-5 gap-2' : 'grid-cols-2 gap-3';
    } else if (width < 1024) {
      categoryGrid = isLandscape ? 'grid-cols-6 gap-4' : 'grid-cols-3 gap-4';
      productGrid = isLandscape ? 'grid-cols-6 gap-3' : 'grid-cols-3 gap-4';
    } else {
      categoryGrid = 'grid-cols-4 gap-6';
      productGrid = 'grid-cols-5 gap-4';
    }
    
    return {
      categoryGrid,
      productGrid,
      padding: width < 480 ? 'p-3' : 'p-4',
      headerHeight: 'h-14',
      buttonSize: width < 480 ? 'py-2' : 'py-2.5'
    };
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!selectedCategory || !productData[selectedCategory]) return [];
    
    const products = productData[selectedCategory];
    if (!searchTerm) return products;
    
    return products.filter(product => 
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedCategory, productData, searchTerm]);

  // Quote management
  const addToQuote = (product) => {
    const existing = quote.find(item => item.code === product.code);
    if (existing) {
      setQuote(quote.map(item => 
        item.code === product.code 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setQuote([...quote, { ...product, quantity: 1, priceNote: '' }]);
    }
  };

  const updateQuoteItem = (code, field, value) => {
    setQuote(quote.map(item => 
      item.code === code ? { ...item, [field]: value } : item
    ));
  };

  const removeFromQuote = (code) => {
    setQuote(quote.filter(item => item.code !== code));
  };

  const generateQuoteText = () => {
    const currentDate = new Date().toLocaleDateString();
    const quoteNumber = `OZZ-${Date.now().toString().slice(-6)}`;
    
    let text = `🏪 OZZ CASH AND CARRY - QUOTE REQUEST\n`;
    text += `📅 Date: ${currentDate}\n`;
    text += `📋 Quote #: ${quoteNumber}\n`;
    text += `👤 Sales Rep: [Your Name]\n\n`;
    text += `📦 ITEMS REQUESTED:\n`;
    text += `${'='.repeat(40)}\n\n`;
    
    let totalItems = 0;
    quote.forEach((item, index) => {
      totalItems += item.quantity;
      text += `${index + 1}. ${item.code} - ${item.description}\n`;
      text += `   Quantity: ${item.quantity}`;
      if (item.priceNote) text += ` | Price: ${item.priceNote}`;
      if (item.supplierRef) text += ` | Ref: ${item.supplierRef}`;
      text += `\n\n`;
    });
    
    text += `${'='.repeat(40)}\n`;
    text += `📊 SUMMARY: ${quote.length} different items, ${totalItems} total units\n\n`;
    text += `💬 Please provide pricing and availability.\n`;
    text += `📱 Contact: [Your Phone Number]\n`;
    text += `📧 Email: [Your Email]\n\n`;
    text += `Thank you for your business! 🤝`;
    
    return text;
  };

  const config = getGridConfig();

  // Simplified icons
  const Search = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const ShoppingCart = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m-2.4 8L5 21h14M9 19a2 2 0 11-4 0 2 2 0 014 0zM20 19a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

  const ArrowLeft = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );

  const Plus = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const Minus = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );

  const X = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const RefreshIcon = ({ className, ...props }) => (
    <svg className={className} {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with Image Status and Refresh Button */}
      <header className={`bg-white shadow-sm border-b sticky top-0 z-40 ${config.headerHeight}`}>
        <div className={`${config.padding} h-full`}>
          <div className="flex items-center justify-between h-full">
            {currentView !== 'categories' && (
              <button 
                onClick={() => {
                  if (selectedProduct) {
                    setSelectedProduct(null);
                  } else {
                    setCurrentView('categories');
                    setSelectedCategory(null);
                    setSearchTerm('');
                  }
                }}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
            )}
            
            <div className="flex-1 min-w-0 px-2">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {selectedProduct ? 
                  (selectedProduct.description.length > (window.innerWidth < 480 ? 20 : 30) ? 
                    selectedProduct.description.substring(0, window.innerWidth < 480 ? 20 : 30) + '...' : 
                    selectedProduct.description) :
                 selectedCategory ? selectedCategory : 'Ozz Cash and Carry'}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm text-gray-500">Sales Catalog</p>
                {/* Image System Status Indicator */}
                {imageStats && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${imageSystemReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {imageStats.mappedProducts} images
                    </span>
                    {imageStats.cacheInfo && (
                      <span className="text-xs text-gray-400 hidden md:inline">
                        ({imageStats.cacheInfo.age}m)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Manual Refresh Button */}
              {imageSystemReady && (
                <button 
                  onClick={async () => {
                    console.log('🔄 Manual refresh triggered');
                    setImageSystemReady(false);
                    await imageSystem.forceRefresh();
                    const stats = imageSystem.getStats();
                    setImageStats(stats);
                    setImageSystemReady(true);
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  title="Refresh image cache"
                >
                  <RefreshIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <button 
                onClick={() => setShowQuote(true)}
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                {quote.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {quote.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Loading Screen */}
      {isLoading && (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading Catalog...</h2>
            <p className="text-gray-600">Loading product database...</p>
          </div>
        </div>
      )}

      {/* Categories View */}
      {!isLoading && currentView === 'categories' && !selectedProduct && (
        <div className={config.padding}>
          <div className={`grid ${config.categoryGrid}`}>
            {Object.keys(categoryConfig).map(category => {
              const categoryConf = categoryConfig[category];
              const count = productData[category]?.length || 0;
              
              return (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setCurrentView('products');
                  }}
                  className={`${categoryConf.color} border-2 rounded-xl p-3 sm:p-4 lg:p-6 text-left transition-all active:scale-95 hover:shadow-md`}
                  style={{ touchAction: 'manipulation' }}
                  disabled={count === 0}
                >
                  <div className="text-2xl sm:text-3xl mb-2">{categoryConf.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base leading-tight">{category}</h3>
                  <p className="text-xs sm:text-sm text-gray-600">{count} items</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Products View */}
      {!isLoading && currentView === 'products' && !selectedProduct && (
        <div>
          {/* Search */}
          <div className={`${config.padding} bg-white border-b`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-4 py-2 sm:py-3 bg-gray-50 border-0 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className={config.padding}>
            <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600">
              {filteredProducts.length} products in {selectedCategory}
            </div>
            
            <div className={`grid ${config.productGrid}`}>
              {filteredProducts.map(product => (
                <div 
                  key={product.code}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="w-full text-left hover:bg-gray-50 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {/* Enhanced Image Container with Level 2 Optimization */}
                    <EnhancedImageContainer 
                      product={product}
                      selectedCategory={selectedCategory}
                      setSelectedProduct={setSelectedProduct}
                    />
                    
                    <div className="p-2 sm:p-3">
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm mb-1">
                        {product.code}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                        {window.innerWidth < 480 && product.description.length > 40 
                          ? product.description.substring(0, 40) + '...'
                          : product.description}
                      </p>
                      {product.supplierRef && (
                        <p className="text-xs text-blue-600 mt-1">
                          Ref: {product.supplierRef}
                        </p>
                      )}
                    </div>
                  </button>
                  
                  <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                    <button
                      onClick={() => addToQuote(product)}
                      className={`w-full bg-blue-600 text-white ${config.buttonSize} rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      Add to Quote
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500">No products found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Detail View */}
      {!isLoading && selectedProduct && (
        <div className={config.padding}>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm max-w-2xl mx-auto">
            <div className="aspect-square bg-gray-50">
              <img 
                src={imageSystem.getImageUrl(selectedCategory, selectedProduct.code)}
                alt={selectedProduct.description}
                className="w-full h-full object-contain"
                style={{ transform: 'scale(1.1)', transformOrigin: 'center center' }}
              />
            </div>
            
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                {selectedProduct.description}
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-4">Code: {selectedProduct.code}</p>
              
              {selectedProduct.supplierRef && (
                <p className="text-sm text-gray-500 mb-2">
                  Supplier Ref: {selectedProduct.supplierRef}
                </p>
              )}
              
              {selectedProduct.soh && (
                <p className="text-sm text-green-600 mb-4 font-medium">
                  Stock on Hand: {selectedProduct.soh}
                </p>
              )}
              
              <div className="border-t pt-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Notes
                  </label>
                  <textarea 
                    placeholder="Add pricing information..."
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>
                
                <button
                  onClick={() => addToQuote(selectedProduct)}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-base sm:text-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  Add to Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {showQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-xl sm:rounded-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-base sm:text-lg font-semibold">Quote ({quote.length} items)</h3>
              <button 
                onClick={() => setShowQuote(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {quote.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📋</div>
                  <p className="text-gray-500">No items in quote</p>
                  <p className="text-sm text-gray-400 mt-1">Add products to build your quote</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quote.map(item => (
                    <div key={item.code} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-medium text-sm sm:text-base">{item.code}</p>
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{item.description}</p>
                          {item.supplierRef && (
                            <p className="text-xs text-blue-600">Ref: {item.supplierRef}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => removeFromQuote(item.code)}
                          className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-3">
                        <button 
                          onClick={() => updateQuoteItem(item.code, 'quantity', Math.max(1, item.quantity - 1))}
                          className="p-2 rounded border hover:bg-gray-50 transition-colors"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium text-sm sm:text-base">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuoteItem(item.code, 'quantity', item.quantity + 1)}
                          className="p-2 rounded border hover:bg-gray-50 transition-colors"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <input 
                        placeholder="Price note..."
                        value={item.priceNote}
                        onChange={(e) => updateQuoteItem(item.code, 'priceNote', e.target.value)}
                        className="w-full p-2 sm:p-3 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {quote.length > 0 && (
              <div className="border-t p-4 space-y-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateQuoteText());
                    alert('Quote copied to clipboard!');
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-green-700 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  Copy Quote to Clipboard
                </button>
                <button
                  onClick={() => {
                    const text = generateQuoteText();
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  className="w-full bg-green-500 text-white py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-green-600 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  Share via WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Render the app
ReactDOM.render(<OzzCatalog />, document.getElementById('root'));
