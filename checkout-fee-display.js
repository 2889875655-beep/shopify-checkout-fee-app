// /**
//  * Shopify结账费用显示脚本
//  * 功能：在结账页面实时显示美国地区的8%税+2%保险费用
//  * 适用：skullisjewelry.com
//  */

// (function() {
//   'use strict';
  
//   console.log('💰 地区费用显示脚本已加载');
  
//   // 配置
//   const CONFIG = {
//     taxRate: 0.08,      // 8% 销售税
//     insuranceRate: 0.02, // 2% 保险费
//     checkInterval: 1000, // 检查间隔（毫秒）
//     usCountryCode: 'US'
//   };
  
//   // 主控制器
//   class CheckoutFeeDisplay {
//     constructor() {
//       this.isInitialized = false;
//       this.currentFees = {
//         tax: 0,
//         insurance: 0,
//         total: 0
//       };
//       this.observer = null;
//       this.init();
//     }
    
//     init() {
//       if (this.shouldRunOnThisPage()) {
//         console.log('🛒 检测到结账页面，启动费用显示');
//         this.setupObserver();
//         this.startMonitoring();
//       }
//     }
    
//     shouldRunOnThisPage() {
//       // 检查是否在结账相关页面
//       const path = window.location.pathname;
//       return /(\/cart|\/checkout|\/thank_you)/.test(path) || 
//              document.querySelector('[data-checkout]') ||
//              document.querySelector('[data-cart]');
//     }
    
//     setupObserver() {
//       // 使用MutationObserver监听DOM变化
//       this.observer = new MutationObserver((mutations) => {
//         mutations.forEach(() => {
//           this.checkAndUpdateFees();
//         });
//       });
      
//       // 监听整个文档的变化
//       this.observer.observe(document.body, {
//         childList: true,
//         subtree: true,
//         attributes: true,
//         characterData: true
//       });
//     }
    
//     startMonitoring() {
//       // 初始检查
//       this.checkAndUpdateFees();
      
//       // 定期检查（防止某些动态加载情况）
//       setInterval(() => this.checkAndUpdateFees(), CONFIG.checkInterval);
      
//       // 监听地址字段变化
//       this.setupAddressListeners();
//     }
    
//     setupAddressListeners() {
//       // 监听所有可能是地址字段的输入
//       const addressSelectors = [
//         'select[name*="country"]',
//         'input[name*="country"]',
//         'select[name*="shipping_address"]',
//         'input[name*="zip"]',
//         'input[name*="postal"]',
//         'input[name*="province"]',
//         'input[name*="state"]'
//       ];
      
//       addressSelectors.forEach(selector => {
//         document.querySelectorAll(selector).forEach(element => {
//           element.addEventListener('change', () => {
//             setTimeout(() => this.checkAndUpdateFees(), 300);
//           });
//           element.addEventListener('input', () => {
//             setTimeout(() => this.checkAndUpdateFees(), 500);
//           });
//         });
//       });
//     }
    
//     checkAndUpdateFees() {
//       const address = this.getCurrentAddress();
//       const subtotal = this.getSubtotal();
      
//       if (!address || subtotal <= 0) {
//         this.removeFeeDisplay();
//         return;
//       }
      
//       const isUS = address.country.toUpperCase() === CONFIG.usCountryCode;
      
//       if (isUS) {
//         this.calculateAndDisplayFees(subtotal);
//       } else {
//         this.removeFeeDisplay();
//       }
//     }
    
//     getCurrentAddress() {
//       // 尝试多种方式获取地址信息
//       const selectors = [
//         // Shopify标准结账
//         'select[name="checkout[shipping_address][country]"]',
//         'select[name="shipping_address[country]"]',
//         'input[name="address[country]"]',
//         // 备用选择器
//         '[data-address-field="country"] select',
//         '.field__input[data-country]',
//         '.select__select[name*="country"]'
//       ];
      
//       let countryElement = null;
//       for (const selector of selectors) {
//         countryElement = document.querySelector(selector);
//         if (countryElement) break;
//       }
      
//       if (!countryElement) {
//         console.log('📍 未找到国家选择字段');
//         return null;
//       }
      
//       const country = countryElement.tagName === 'SELECT' 
//         ? countryElement.value 
//         : countryElement.getAttribute('value') || countryElement.textContent;
      
//       return {
//         country: country.trim(),
//         element: countryElement
//       };
//     }
    
//     getSubtotal() {
//       // 尝试多种方式获取小计金额
//       const subtotalSelectors = [
//         '[data-checkout-subtotal-price-target]',
//         '[data-cart-subtotal]',
//         '.cart-subtotal__price',
//         '.order-summary__section--total-lines',
//         '.total-line--subtotal .total-line__price',
//         '.payment-due__price'
//       ];
      
//       for (const selector of subtotalSelectors) {
//         const element = document.querySelector(selector);
//         if (element) {
//           const text = element.textContent || element.innerText;
//           const amount = this.extractPrice(text);
//           if (amount > 0) return amount;
//         }
//       }
      
//       // 备用：从商品行计算
//       return this.calculateSubtotalFromItems();
//     }
    
//     extractPrice(text) {
//       if (!text) return 0;
//       // 提取数字，处理 $100.00, 100.00, €100,00 等格式
//       const match = text.replace(/[^\d.,]/g, '').match(/([\d,.]+)/);
//       if (match) {
//         const numberStr = match[1].replace(/,/g, '');
//         return parseFloat(numberStr) || 0;
//       }
//       return 0;
//     }
    
//     calculateSubtotalFromItems() {
//       let subtotal = 0;
//       // 尝试从商品行计算
//       const itemSelectors = [
//         '.product__price',
//         '.cart-item__price',
//         '[data-product-price]',
//         '.order-summary__section--product-list'
//       ];
      
//       itemSelectors.forEach(selector => {
//         document.querySelectorAll(selector).forEach(el => {
//           const price = this.extractPrice(el.textContent);
//           // 简单假设每行是一个商品
//           subtotal += price;
//         });
//       });
      
//       return subtotal;
//     }
    
//     calculateAndDisplayFees(subtotal) {
//       const taxAmount = subtotal * CONFIG.taxRate;
//       const insuranceAmount = subtotal * CONFIG.insuranceRate;
//       const totalFee = taxAmount + insuranceAmount;
      
//       // 如果费用未变化，跳过更新
//       if (this.currentFees.total === totalFee) return;
      
//       this.currentFees = {
//         tax: taxAmount,
//         insurance: insuranceAmount,
//         total: totalFee
//       };
      
//       this.updateFeeDisplay(subtotal, taxAmount, insuranceAmount, totalFee);
//     }
    
//     updateFeeDisplay(subtotal, taxAmount, insuranceAmount, totalFee) {
//       // 移除旧的费用显示
//       this.removeFeeDisplay();
      
//       // 创建费用显示HTML
//       const feeContainer = document.createElement('div');
//       feeContainer.className = 'region-fee-display';
//       feeContainer.style.cssText = `
//         margin: 15px 0;
//         padding: 15px;
//         background: #f8f9fa;
//         border-radius: 8px;
//         border-left: 4px solid #007bff;
//         animation: fadeIn 0.3s ease-in;
//       `;
      
//       // 添加CSS动画
//       if (!document.querySelector('#fee-display-styles')) {
//         const style = document.createElement('style');
//         style.id = 'fee-display-styles';
//         style.textContent = `
//           @keyframes fadeIn {
//             from { opacity: 0; transform: translateY(-10px); }
//             to { opacity: 1; transform: translateY(0); }
//           }
//           .fee-line {
//             display: flex;
//             justify-content: space-between;
//             margin: 8px 0;
//             padding: 5px 0;
//             border-bottom: 1px solid #eee;
//           }
//           .fee-total {
//             font-weight: bold;
//             border-top: 2px solid #007bff;
//             padding-top: 10px;
//             margin-top: 10px;
//           }
//           .fee-note {
//             font-size: 12px;
//             color: #6c757d;
//             margin-top: 5px;
//             font-style: italic;
//           }
//         `;
//         document.head.appendChild(style);
//       }
      
//       feeContainer.innerHTML = `
//         <div style="font-weight: bold; color: #007bff; margin-bottom: 10px;">
//           🇺🇸 美国地区费用明细
//         </div>
        
//         <div class="fee-line">
//           <span>商品小计:</span>
//           <span>$${subtotal.toFixed(2)}</span>
//         </div>
        
//         <div class="fee-line">
//           <span>销售税 (8%):</span>
//           <span>+ $${taxAmount.toFixed(2)}</span>
//         </div>
        
//         <div class="fee-line">
//           <span>保险费 (2%):</span>
//           <span>+ $${insuranceAmount.toFixed(2)}</span>
//         </div>
        
//         <div class="fee-line fee-total">
//           <span>预估总计:</span>
//           <span>$${(subtotal + totalFee).toFixed(2)}</span>
//         </div>
        
//         <div class="fee-note">
//           注：此为美国地区预估费用，实际费用以订单确认为准
//         </div>
//       `;
      
//       // 插入到合适位置
//       const insertPoints = [
//         '.order-summary__section--total-lines',
//         '.total-line-table__footer',
//         '.payment-due__price',
//         '.total-line--total',
//         '[data-order-summary]'
//       ];
      
//       for (const selector of insertPoints) {
//         const target = document.querySelector(selector);
//         if (target) {
//           target.parentNode.insertBefore(feeContainer, target);
//           console.log('✅ 费用显示已更新');
//           return;
//         }
//       }
      
//       // 如果找不到标准位置，插入到页面底部
//       document.body.appendChild(feeContainer);
//     }
    
//     removeFeeDisplay() {
//       const existing = document.querySelector('.region-fee-display');
//       if (existing) {
//         existing.remove();
//         this.currentFees = { tax: 0, insurance: 0, total: 0 };
//       }
//     }
    
//     destroy() {
//       if (this.observer) {
//         this.observer.disconnect();
//       }
//       this.removeFeeDisplay();
//     }
//   }
  
//   // 页面加载后启动
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => {
//       window.checkoutFeeDisplay = new CheckoutFeeDisplay();
//     });
//   } else {
//     window.checkoutFeeDisplay = new CheckoutFeeDisplay();
//   }
  
//   // 导出到全局，方便调试
//   window.CheckoutFeeDisplay = CheckoutFeeDisplay;
  
// })();
