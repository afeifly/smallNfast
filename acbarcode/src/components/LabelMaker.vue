<template>
  <div class="label-maker">
    <h1>Product Label Generator</h1>
    
    <!-- Admin Navigation Tabs -->
    <div v-if="isAdmin" class="admin-tabs">
      <button :class="{ active: activeTab === 'maker' }" @click="activeTab = 'maker'">Label Maker</button>
      <button :class="{ active: activeTab === 'products' }" @click="activeTab = 'products'">Manage Products</button>
    </div>

    <!-- TAB 1: Label Maker -->
    <div v-if="activeTab === 'maker'">
      <form @submit.prevent="generateLabels">
        <div class="form-group">
          <label>Item Number</label>
          <div class="custom-dropdown">
            <div class="dropdown-selected" @click="toggleDropdown">
              <span>{{ selectedItemNumber || 'Select a product...' }}</span>
              <span class="dropdown-arrow" :class="{ 'open': isDropdownOpen }">▼</span>
            </div>
            <div v-if="isDropdownOpen" class="dropdown-options">
              <div class="search-box">
                <input 
                  type="text" 
                  v-model="searchQuery" 
                  placeholder="Search item number..." 
                  @click.stop
                />
              </div>
              <div class="chips-container">
                <div 
                  v-for="product in filteredProducts" 
                  :key="product.item"
                  class="chip"
                  :class="{ 'selected': product.item === selectedItemNumber }"
                  @click="selectItem(product.item)"
                >
                  {{ product.item }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Product Name</label>
          <input type="text" v-model="productName" readonly />
        </div>
        
        <!-- Band & Logo Selection (Read-only on maker page, editable in Manage Products) -->
        <div class="form-group">
          <label>Logo / Band</label>
          <input 
            type="text" 
            :value="selectedBand === 'pneumatech' ? 'Pneumatech' : 'Atlas Copco'" 
            readonly 
          />
        </div>

        <div class="form-group">
          <label>Serial Numbers (one per line, max 10)</label>
          <textarea v-model="serialNumbersInput" rows="5" placeholder="Enter up to 10 serial numbers, one per line"></textarea>
        </div>
        <button type="submit" :disabled="!selectedItemNumber">Generate Labels</button>
      </form>

      <div v-if="labels.length" class="labels-preview">
        <h2>Preview</h2>
        <div class="labels-list">
          <div v-for="(label, idx) in labels" :key="label.serial" class="label-card clickable-card" @click="downloadSinglePDF(idx)">
            <div class="label-content">
              <div class="label-title">{{ productName }}</div>
              <div class="label-subtitle">Item No.: {{ selectedItemNumber }}</div>
              <div class="label-serial">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SN: {{ label.serial }}</div>
              <div class="barcode-container">
                <svg :id="'barcode-' + idx" class="barcode-svg"></svg>
              </div>
              <div class="label-footer">
                <span class="website">{{ websiteMap[selectedBand] || 'www.atlascopco.com' }}</span>
                <img :src="logoMap[selectedBand] || '/logo.png'" alt="Logo" class="logo" />
              </div>
            </div>
            <div class="download-hint">Click to download PDF</div>
          </div>
        </div>
        <div class="download-buttons">
          <button @click="downloadPDF">Download All</button>
        </div>
      </div>
    </div>

    <!-- TAB 2: Manage Products (Admin Only) -->
    <div v-else-if="activeTab === 'products' && isAdmin" class="products-management">
      <div class="management-header">
        <h2>Products Directory</h2>
        <button class="add-btn" @click="openAddModal">Add New Product</button>
      </div>
      
      <div class="search-bar">
        <input 
          type="text" 
          v-model="productSearchQuery" 
          placeholder="Search by item number or name..."
        />
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Item Number</th>
              <th>Product Name</th>
              <th>Default Band / Logo</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in searchedProducts" :key="product.item">
              <td>{{ product.item }}</td>
              <td>{{ product.name }}</td>
              <td>
                <span class="band-tag" :class="product.band || 'atlascopco'">
                  {{ product.band === 'pneumatech' ? 'Pneumatech' : 'Atlas Copco' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="edit-action" @click="openEditModal(product)">Edit</button>
                <button class="delete-action" @click="deleteProduct(product.item)">Delete</button>
              </td>
            </tr>
            <tr v-if="searchedProducts.length === 0">
              <td colspan="4" class="no-data">No products found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Product Modal (Add/Edit) -->
    <div v-if="showProductModal" class="modal-overlay" @click="showProductModal = false">
      <div class="modal-card" @click.stop>
        <h3>{{ modalMode === 'add' ? 'Add Product' : 'Edit Product' }}</h3>
        <form @submit.prevent="submitProduct">
          <div class="form-group">
            <label>Item Number</label>
            <input 
              type="text" 
              v-model="productForm.item" 
              placeholder="e.g. 1830174222"
              :readonly="modalMode === 'edit'"
              required
            />
          </div>
          <div class="form-group">
            <label>Product Name</label>
            <input 
              type="text" 
              v-model="productForm.name" 
              placeholder="e.g. FL S93 T"
              required
            />
          </div>
          <div class="form-group">
            <label>Default Band / Logo</label>
            <select v-model="productForm.band">
              <option value="atlascopco">Atlas Copco</option>
              <option value="pneumatech">Pneumatech</option>
            </select>
          </div>
          
          <p v-if="productFormError" class="modal-error">{{ productFormError }}</p>
          
          <div class="modal-actions">
            <button type="button" class="cancel-btn" @click="showProductModal = false">Cancel</button>
            <button type="submit" :disabled="isSubmittingProduct">
              {{ isSubmittingProduct ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// State Management
const products = ref([]);
const selectedItemNumber = ref('');
const productName = ref('');
const selectedBand = ref('atlascopco');
const serialNumbersInput = ref('');
const labels = ref([]);
const isDropdownOpen = ref(false);
const searchQuery = ref('');

// Admin Role State
const isAdmin = ref(sessionStorage.getItem('acbarcode_role') === 'admin');
const activeTab = ref('maker');

// Products CRUD State
const productSearchQuery = ref('');
const showProductModal = ref(false);
const modalMode = ref('add');
const productFormError = ref('');
const isSubmittingProduct = ref(false);
const productForm = ref({
  item: '',
  name: '',
  band: 'atlascopco'
});

// Brand Logos Configuration
const logoMap = {
  atlascopco: '/logo.png',
  pneumatech: '/pneumatech_logo.png'
};

const websiteMap = {
  atlascopco: 'www.atlascopco.com',
  pneumatech: 'www.pneumatech.com'
};

const bandOptions = [
  { value: 'atlascopco', label: 'Atlas Copco' },
  { value: 'pneumatech', label: 'Pneumatech' }
];

// Fetch Products from Backend
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    const data = await res.json();
    products.value = data;
    
    // Auto-select first product if none selected
    if (products.value.length > 0) {
      const match = products.value.find(p => p.item === selectedItemNumber.value);
      if (!match) {
        selectedItemNumber.value = products.value[0].item;
        productName.value = products.value[0].name;
        selectedBand.value = products.value[0].band || 'atlascopco';
      }
    }
  } catch (error) {
    console.error('Error fetching products list:', error);
  }
}

function onItemNumberChange() {
  const prod = products.value.find(p => p.item === selectedItemNumber.value);
  productName.value = prod ? prod.name : '';
  selectedBand.value = prod ? (prod.band || 'atlascopco') : 'atlascopco';
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
  if (isDropdownOpen.value) {
    searchQuery.value = '';
  }
}

function selectItem(itemNumber) {
  selectedItemNumber.value = itemNumber;
  onItemNumberChange();
  isDropdownOpen.value = false;
  searchQuery.value = '';
}

const filteredProducts = computed(() => {
  if (!searchQuery.value) {
    return products.value;
  }
  return products.value.filter(product => 
    product.item.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    product.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// Close dropdown when clicking outside
function handleClickOutside(event) {
  const dropdown = document.querySelector('.custom-dropdown');
  if (dropdown && !dropdown.contains(event.target)) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  fetchProducts();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function generateLabels() {
  const serials = serialNumbersInput.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  labels.value = serials.map(serial => ({ serial }));
  
  // Wait for DOM to update, then generate barcodes
  nextTick(() => {
    setTimeout(() => {
      labels.value.forEach((label, idx) => {
        const element = document.getElementById(`barcode-${idx}`);
        if (element) {
          try {
            JsBarcode(element, `NS${label.serial}`, {
              format: 'CODE128',
              width: 2,
              height: 50,
              displayValue: false,
              margin: 0,
              background: '#ffffff',
              lineColor: '#000000',
            });
            console.log(`Barcode generated for ${label.serial}`);
          } catch (error) {
            console.error(`Error generating barcode for ${label.serial}:`, error);
          }
        } else {
          console.error(`Element barcode-${idx} not found`);
        }
      });
    }, 200);
  });
}

// Generate image as base64 helper
async function getLogoBase64() {
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  
  const logoPromise = new Promise((resolve) => {
    logoImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = logoImg.width;
      canvas.height = logoImg.height;
      ctx.drawImage(logoImg, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    logoImg.onerror = () => resolve(null);
    logoImg.src = logoMap[selectedBand.value] || '/logo.png';
  });
  
  return await logoPromise;
}

async function downloadSinglePDF(index) {
  try {
    const pdf = new jsPDF({ unit: 'mm', format: [100, 60], orientation: 'landscape' });
    const cardWidth = 100;
    const cardHeight = 60;
    const x = 0, y = 0;
    
    const label = labels.value[index];
    
    // Load appropriate logo as base64
    const logoBase64 = await getLogoBase64();
    
    // Product Name (Left side, top)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(productName.value, x + 5, y + 10);
    
    // Item Number (Left side, under product name)
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(12);
    pdf.text("Item No.: " + selectedItemNumber.value, x + 5, y + 15);
    
    // Serial Number (Right side)
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(12);
    pdf.text(`      SN: ${label.serial}`, x + 5, y + 20);
    
    // Barcode
    const svg = document.getElementById(`barcode-${index}`);
    if (svg) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            canvas.width = img.width || 300;
            canvas.height = img.height || 70;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const barcodeDataUrl = canvas.toDataURL('image/png');
            pdf.addImage(barcodeDataUrl, 'PNG', x + 5, y + 23, 70, 16);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      } catch (e) {
        console.warn('Could not add barcode to PDF:', e);
      }
    }
    
    // Website (Bottom left)
    pdf.setFontSize(11);
    pdf.text(websiteMap[selectedBand.value] || 'www.atlascopco.com', x + 5, y + cardHeight - 4);
    
    // Logo (Bottom right)
    if (logoBase64) {
      try {
        pdf.addImage(logoBase64, 'PNG', x + cardWidth - 31, y + cardHeight - 17, 30, 15);
      } catch (e) {
        console.warn('Could not add logo to PDF:', e);
      }
    }
    
    pdf.save(`${productName.value}_${label.serial}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
}

async function downloadPDF() {
  try {
    const pdf = new jsPDF({ unit: 'mm', format: [100, 60], orientation: 'landscape' });
    const cardWidth = 100;
    const cardHeight = 60;
    let x = 0, y = 0;
    
    // Load logo as base64 first
    const logoBase64 = await getLogoBase64();
    
    for (let idx = 0; idx < labels.value.length; idx++) {
      const label = labels.value[idx];
      
      // Add new page for each label except the first one
      if (idx > 0) {
        pdf.addPage();
      }
      
      // Product Name (Left side, top)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(productName.value, x + 5, y + 10);
      
      // Item Number (Left side, under product name)
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(12);
      pdf.text("Item No.: " + selectedItemNumber.value, x + 5, y + 15);
      
      // Serial Number (Right side)
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(12);
      pdf.text(`      SN: ${label.serial}`, x + 5, y + 20);
      
      // Barcode (convert SVG to canvas first)
      const svg = document.getElementById(`barcode-${idx}`);
      if (svg) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = () => {
              canvas.width = img.width || 300;
              canvas.height = img.height || 70;
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              const barcodeDataUrl = canvas.toDataURL('image/png');
              pdf.addImage(barcodeDataUrl, 'PNG', x + 5, y + 23, 70, 16);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          });
        } catch (e) {
          console.warn('Could not add barcode to PDF:', e);
        }
      }
      
      // Website (Bottom left)
      pdf.setFontSize(11);
      pdf.text(websiteMap[selectedBand.value] || 'www.atlascopco.com', x + 5, y + cardHeight - 4);
      
      // Logo (Bottom right)
      if (logoBase64) {
        try {
          pdf.addImage(logoBase64, 'PNG', x + cardWidth - 31, y + cardHeight - 17, 30, 15);
        } catch (e) {
          console.warn('Could not add logo to PDF:', e);
        }
      }
    }
    
    pdf.save(`${productName.value}_labels.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
}

// Product Management computed & functions (Admin Only)
const searchedProducts = computed(() => {
  if (!productSearchQuery.value) {
    return products.value;
  }
  const q = productSearchQuery.value.toLowerCase();
  return products.value.filter(p => 
    p.item.toLowerCase().includes(q) || 
    p.name.toLowerCase().includes(q)
  );
});

function openAddModal() {
  modalMode.value = 'add';
  productForm.value = {
    item: '',
    name: '',
    band: 'atlascopco'
  };
  productFormError.value = '';
  showProductModal.value = true;
}

function openEditModal(product) {
  modalMode.value = 'edit';
  productForm.value = {
    item: product.item,
    name: product.name,
    band: product.band || 'atlascopco'
  };
  productFormError.value = '';
  showProductModal.value = true;
}

async function submitProduct() {
  productFormError.value = '';
  if (!productForm.value.item.trim() || !productForm.value.name.trim()) {
    productFormError.value = 'Item number and name are required';
    return;
  }
  
  isSubmittingProduct.value = true;
  const adminPassword = sessionStorage.getItem('acbarcode_role') === 'admin' ? 'SUTOadmin1234' : '';
  
  try {
    const url = modalMode.value === 'add' 
      ? '/api/products' 
      : `/api/products/${encodeURIComponent(productForm.value.item)}`;
      
    const method = modalMode.value === 'add' ? 'POST' : 'PUT';
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify(productForm.value)
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save product');
    }
    
    await fetchProducts();
    showProductModal.value = false;
  } catch (err) {
    console.error(err);
    productFormError.value = err.message;
  } finally {
    isSubmittingProduct.value = false;
  }
}

async function deleteProduct(itemNumber) {
  if (!confirm(`Are you sure you want to delete product ${itemNumber}?`)) {
    return;
  }
  
  const adminPassword = sessionStorage.getItem('acbarcode_role') === 'admin' ? 'SUTOadmin1234' : '';
  
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(itemNumber)}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Password': adminPassword
      }
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete product');
    }
    
    await fetchProducts();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.label-maker {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

h1 {
  color: white;
  text-align: center;
  font-size: 2.5rem;
  font-weight: 300;
  margin-bottom: 2rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

h2 {
  color: #333;
  font-size: 1.8rem;
  font-weight: 400;
  margin-bottom: 1.5rem;
}

/* Admin Tabs Navigation */
.admin-tabs {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.admin-tabs button {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid transparent;
  color: white;
  padding: 10px 24px;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: none;
}

.admin-tabs button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: none;
}

.admin-tabs button.active {
  background: white;
  color: #764ba2;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

form {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

select, input, textarea {
  width: 100%;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  font-family: inherit;
}

/* Radio buttons band selector */
.radio-group {
  display: flex;
  gap: 24px;
  padding: 8px 0;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal !important;
  color: #333;
  font-size: 0.95rem;
}

.radio-label input[type="radio"] {
  width: auto;
  margin: 0;
  cursor: pointer;
  accent-color: #667eea;
}

.custom-dropdown {
  position: relative;
  width: 100%;
}

.dropdown-selected {
  width: 100%;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}

.dropdown-selected:hover {
  border-color: #667eea;
}

.dropdown-arrow {
  transition: transform 0.3s ease;
  color: #666;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 1000;
  max-height: 400px;
  overflow-y: auto;
}

.search-box {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.search-box input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  margin: 0;
}

.chips-container {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.chip {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  white-space: nowrap;
}

.chip:hover {
  background: #e9ecef;
  border-color: #667eea;
  transform: translateY(-1px);
}

.chip.selected {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

select:focus, input:focus, textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

input[readonly] {
  background-color: #f5f5f5;
  color: #666;
}

textarea {
  resize: vertical;
  min-height: 120px;
}

button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.labels-preview {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.labels-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
  margin-bottom: 2rem;
}

.label-card {
  background: #fff;
  border: 2px solid #333;
  border-radius: 8px;
  width: 350px;
  height: 225px;
  padding: 15px;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  flex-shrink: 0;
}

.label-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  border-color: #667eea;
  cursor: pointer;
}

.clickable-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.download-hint {
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: #666;
  background: rgba(255,255,255,0.9);
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.label-card:hover .download-hint {
  opacity: 1;
}

.label-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  position: relative;
}

.label-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
  margin-top: 5px;
  line-height: 1.2;
}

.label-subtitle {
  font-size: 1rem;
  color: #333;
  margin-bottom: 4px;
  font-weight: normal;
  line-height: 1.2;
}

.label-serial {
  font-size: 1rem;
  color: #333;
  margin-bottom: 2px;
  font-weight: normal;
  line-height: 1.2;
}

.barcode-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: 2px 0 0 1px;
  min-height: 60px;
  background: white;
  padding: 0;
}

.barcode-svg {
  max-width: 300px;
  height: auto;
}

.label-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  bottom: 10px;
  left: 15px;
  right: 15px;
}

.website {
  font-size: 1rem;
  color: #333;
  font-weight: normal;
}

.logo {
  height: 22px;
  width: auto;
  max-width: 60px;
  object-fit: contain;
}

.download-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.download-buttons button {
  min-width: 180px;
}

/* Products Management Admin Section */
.products-management {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.add-btn {
  padding: 10px 20px;
  font-size: 0.95rem;
}

.table-container {
  width: 100%;
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.95rem;
}

th, td {
  padding: 14px 18px;
  border-bottom: 1px solid #e0e0e0;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover td {
  background-color: #fdfdfd;
}

.band-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 500;
}

.band-tag.atlascopco {
  background-color: #fff9db;
  color: #f59f00;
  border: 1px solid #ffe3e3;
}

/* Let's style Atlas Copco yellow-like or clean blue */
.band-tag.atlascopco {
  background-color: #e3f2fd;
  color: #0d47a1;
}

.band-tag.pneumatech {
  background-color: #e8f5e9;
  color: #1b5e20;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.edit-action, .delete-action {
  padding: 6px 12px;
  font-size: 0.85rem;
  border-radius: 4px;
  min-height: unset;
  width: auto;
  box-shadow: none;
}

.edit-action {
  background: #eaeaea;
  color: #333;
}

.edit-action:hover {
  background: #ddd;
  transform: none;
  box-shadow: none;
}

.delete-action {
  background: #fee2e2;
  color: #b91c1c;
}

.delete-action:hover {
  background: #fecaca;
  transform: none;
  box-shadow: none;
}

.no-data {
  text-align: center;
  color: #888;
  padding: 24px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-card {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  padding: 32px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  animation: scaleUp 0.25s ease-out;
}

@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-card h3 {
  margin-bottom: 20px;
  font-size: 1.4rem;
  color: #333;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.modal-actions button {
  min-width: 100px;
  padding: 10px 16px;
  font-size: 0.95rem;
}

.cancel-btn {
  background: #eaeaea;
  color: #333;
  box-shadow: none;
}

.cancel-btn:hover {
  background: #ddd;
  transform: none;
  box-shadow: none;
}

.modal-error {
  color: #b91c1c;
  background: #fee2e2;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 12px;
}

/* Responsive design */
@media (max-width: 768px) {
  .label-maker {
    padding: 16px;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  form, .labels-preview, .products-management {
    padding: 24px;
  }
  
  .labels-list {
    justify-content: center;
  }
  
  .label-card {
    width: 320px;
    height: 200px;
  }
  
  .download-buttons {
    flex-direction: column;
  }
  
  .download-buttons button {
    width: 100%;
  }
  
  .radio-group {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
