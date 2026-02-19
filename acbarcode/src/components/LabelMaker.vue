<template>
  <div class="label-maker">
    <h1>Product Label Generator</h1>
    <form @submit.prevent="generateLabels">
      <div class="form-group">
        <label>Item Number</label>
        <div class="custom-dropdown">
          <div class="dropdown-selected" @click="toggleDropdown">
            <span>{{ selectedItemNumber }}</span>
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
      <div class="form-group">
        <label>Serial Numbers (one per line, max 10)</label>
        <textarea v-model="serialNumbersInput" rows="5" placeholder="Enter up to 10 serial numbers, one per line"></textarea>
      </div>
      <button type="submit">Generate Labels</button>
    </form>

    <div v-if="labels.length" class="labels-preview">
      <h2>Preview</h2>
             <div class="labels-list">
         <div v-for="(label, idx) in labels" :key="label.serial" class="label-card clickable-card" @click="downloadSinglePDF(idx)">
           <div class="label-content">
             <div class="label-title">{{ productName }}</div>
             <div class="label-subtitle">Item No.: {{ selectedItemNumber }}</div>
             <div class="label-serial">       &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SN: {{ label.serial }}</div>
             <div class="barcode-container">
               <svg :id="'barcode-' + idx" class="barcode-svg"></svg>
             </div>
             <div class="label-footer">
               <span class="website">www.atlascopco.com</span>
               <img src="/logo.png" alt="Logo" class="logo" />
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
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const products = [
  { item: '1830174222', name: 'FL S93 T' },
  { item: '1830174237', name: 'FL S93 T' },
  { item: '1830174221', name: 'FL S93 T' },
  { item: '1830174236', name: 'FL S93 T' },
  { item: '1830174223', name: 'FL S93 T' },
  { item: '1830174238', name: 'FL S93 T' },

  { item: '1830138002', name: 'FL S185 T' },
  { item: '1830138003', name: 'FL S185 T' },
  { item: '1830174224', name: 'FL S185 T' },
  { item: '1830174226', name: 'FL S185 T' },
  { item: '1830174239', name: 'FL S185 T' },

  { item: '1830138004', name: 'FL S224 T' },
  { item: '1830138005', name: 'FL S224 T' },
  { item: '1830174229', name: 'FL S224 T' },
  { item: '1830174240', name: 'FL S224 T' },

  { item: '1830174232', name: 'FL S200 P' },
  { item: '1830174219', name: 'FL S200 P' },
  { item: '1830174235', name: 'FL S260 P' },
  { item: '1830174220', name: 'FL S260 P' },

  { item: '1830138006', name: 'FL S200 P' },
  { item: '1830138007', name: 'FL S200 P' },
  { item: '1830138008', name: 'FL S260 P' },
  { item: '1830138009', name: 'FL S260 P' },
  { item: '1830138010', name: 'FLI D08 C' },
  { item: '1830138011', name: 'FLI D08 C' },
  { item: '1830138012', name: 'FLI D08 C' },
  { item: '1830138013', name: 'FLI D08 C' },

  { item: '1830174204', name: 'FLI D15 A' },
  { item: '1830174207', name: 'FLI D20 A' },
  { item: '1830174210', name: 'FLI D25 A' },
  { item: '1830174213', name: 'FLI D32 A' },


  { item: '1830174203', name: 'FLI D15 A' },
  { item: '1830174206', name: 'FLI D20 A' },
  { item: '1830174219', name: 'FLI D25 A' },
  { item: '1830174212', name: 'FLI D32 A' },


  { item: '1830174205', name: 'FLI D15 A' },
  { item: '1830174208', name: 'FLI D20 A' },
  { item: '1830174211', name: 'FLI D25 A' },
  { item: '1830174214', name: 'FLI D32 A' },

  { item: '1830174215', name: 'FLI D40 A' },
  { item: '1830174216', name: 'FLI D50 A' },
  { item: '1830174217', name: 'FLI D65 A' },
  { item: '1830174218', name: 'FLI D80 A' },

  { item: '1830174188', name: 'FLI D15 A' },
  { item: '1830174191', name: 'FLI D20 A' },
  { item: '1830174194', name: 'FLI D25 A' },
  { item: '1830174197', name: 'FLI D32 A' },

  { item: '1830174187', name: 'FLI D15 A' },
  { item: '1830174190', name: 'FLI D20 A' },
  { item: '1830174193', name: 'FLI D25 A' },
  { item: '1830174196', name: 'FLI D32 A' },

  { item: '1830174189', name: 'FLI D15 A' },
  { item: '1830174192', name: 'FLI D20 A' },
  { item: '1830174195', name: 'FLI D25 A' },
  { item: '1830174198', name: 'FLI D32 A' },

  { item: '1830174199', name: 'FLI D40 A' },
  { item: '1830174200', name: 'FLI D50 A' },
  { item: '1830174201', name: 'FLI D65 A' },
  { item: '1830174202', name: 'FLI D80 A' },

  { item: '1830138014', name: 'FLI D15 C' },
  { item: '1830138015', name: 'FLI D15 C' },
  { item: '1830138016', name: 'FLI D15 C' },
  { item: '1830138017', name: 'FLI D15 C' },
  { item: '1830138018', name: 'FLI D20 C' },
  { item: '1830138019', name: 'FLI D20 C' },
  { item: '1830138020', name: 'FLI D20 C' },
  { item: '1830138021', name: 'FLI D20 C' },
  { item: '1830138022', name: 'FLI D25 C' },
  { item: '1830138023', name: 'FLI D25 C' },
  { item: '1830138024', name: 'FLI D25 C' },
  { item: '1830138025', name: 'FLI D25 C' },
  { item: '1830138026', name: 'FLI D32 C' },
  { item: '1830138027', name: 'FLI D32 C' },
  { item: '1830138028', name: 'FLI D32 C' },
  { item: '1830138029', name: 'FLI D32 C' },
  { item: '1830138030', name: 'FLI D40 A' },
  { item: '1830138031', name: 'FLI D40 A' },
  { item: '1830138032', name: 'FLI D40 A' },
  { item: '1830138033', name: 'FLI D40 A' },
  { item: '1830138034', name: 'FLI D50 A' },
  { item: '1830138035', name: 'FLI D50 A' },
  { item: '1830138036', name: 'FLI D50 A' },
  { item: '1830138037', name: 'FLI D50 A' },
  { item: '1830138038', name: 'FLI D65 A' },
  { item: '1830138039', name: 'FLI D65 A' },
  { item: '1830138040', name: 'FLI D65 A' },
  { item: '1830138041', name: 'FLI D65 A' },
  { item: '1830138042', name: 'FLI D80 A' },
  { item: '1830138043', name: 'FLI D80 A' },
  { item: '1830138044', name: 'FLI D80 A' },
  { item: '1830138045', name: 'FLI D80 A' },
  { item: '1830154911', name: 'DP T20' },
  { item: '1830154913', name: 'DP T60' },
  { item: '1830154915', name: 'DP T100' },
  { item: '1830154912', name: 'DP T20 P' },
  { item: '1830154914', name: 'DP T60 P' },
  { item: '1830154916', name: 'DP T100 P' },
];

const selectedItemNumber = ref(products[0].item);
const productName = ref(products[0].name);
const serialNumbersInput = ref('');
const labels = ref([]);
const labelCards = ref([]);
const isDropdownOpen = ref(false);
const searchQuery = ref('');

function onItemNumberChange() {
  const prod = products.find(p => p.item === selectedItemNumber.value);
  productName.value = prod ? prod.name : '';
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
    return products;
  }
  return products.filter(product => 
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

async function downloadSinglePDF(index) {
  try {
    const pdf = new jsPDF({ unit: 'mm', format: [100, 60], orientation: 'landscape' });
    const cardWidth = 100;
    const cardHeight = 60;
    const x = 0, y = 0;
    
    const label = labels.value[index];
    
    // Load logo as base64 first
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    const logoPromise = new Promise((resolve, reject) => {
      logoImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = logoImg.width;
        canvas.height = logoImg.height;
        ctx.drawImage(logoImg, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      logoImg.onerror = () => resolve(null);
      logoImg.src = '/logo.png';
    });
    
    const logoBase64 = await logoPromise;
    
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
    pdf.text('www.atlascopco.com', x + 5, y + cardHeight - 4);
    
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
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    const logoPromise = new Promise((resolve, reject) => {
      logoImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = logoImg.width;
        canvas.height = logoImg.height;
        ctx.drawImage(logoImg, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      logoImg.onerror = () => resolve(null); // Continue without logo if it fails
      logoImg.src = '/logo.png';
    });
    
    const logoBase64 = await logoPromise;
    
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
               // Barcode positioned in center
               pdf.addImage(barcodeDataUrl, 'PNG', x + 5, y + 23, 70, 16);
               URL.revokeObjectURL(url);
               resolve();
             };
             img.onerror = () => resolve(); // Continue without barcode if it fails
             img.src = url;
           });
         } catch (e) {
           console.warn('Could not add barcode to PDF:', e);
         }
       }
      
      // Website (Bottom left)
      pdf.setFontSize(11);
      pdf.text('www.atlascopco.com', x + 5, y + cardHeight - 4);
      
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

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

button:active {
  transform: translateY(0);
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
  height: 20px;
  width: 35px;
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

/* Responsive design */
@media (max-width: 768px) {
  .label-maker {
    padding: 16px;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  form, .labels-preview {
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
}

/* Loading animation for barcodes */
svg {
  transition: opacity 0.3s ease;
}

/* Material elevation classes */
.elevation-1 {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.elevation-2 {
  box-shadow: 0 4px 8px rgba(0,0,0,0.12);
}

.elevation-3 {
  box-shadow: 0 8px 16px rgba(0,0,0,0.14);
}
</style> 
