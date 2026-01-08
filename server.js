const express = require('express');
const app = express();

// 解析 JSON 请求
app.use(express.json());

const PORT = 3000;

// ============ 地区检测函数 ============
const isUSRegion = (countryCode, zipCode) => {
  if (!countryCode) return false;
  
  // 转换为大写以便比较
  const country = countryCode.toUpperCase();
  
  // 1. 检查国家代码
  if (country !== 'US') return false;
  
  // 2. 可选：验证美国邮编格式 (5位数字或5+4格式)
  if (zipCode) {
    const usZipRegex = /^\d{5}(-\d{4})?$/;
    return usZipRegex.test(zipCode);
  }
  
  return true;
};

// ============ 你的核心业务逻辑（带地区检测） ============
app.post('/calculate', (req, res) => {
  const { amount, country, zipCode, region } = req.body;
  
  // 验证金额
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ 
      error: '请输入有效的正数金额',
      example: { "amount": 100.50 }
    });
  }
  
  const subtotal = parseFloat(amount);
  
  // 检查是否是美国地区
  const countryCode = country || req.headers['x-country-code'] || req.query.country;
  const userZipCode = zipCode || req.headers['x-zip-code'] || req.query.zip;
  const isUS = isUSRegion(countryCode, userZipCode);
  
  if (!isUS) {
    // 非美国地区：无额外费用
    return res.json({
      success: true,
      region_info: {
        country: countryCode || '未指定',
        zip_code: userZipCode || '未指定',
        is_us: false,
        message: '非美国地区，无额外税费和保险费'
      },
      fees: {
        tax: { rate: '0%', amount: '0.00' },
        insurance: { rate: '0%', amount: '0.00' }
      },
      totals: {
        subtotal: subtotal.toFixed(2),
        additional_fees: '0.00',
        total: subtotal.toFixed(2)
      },
      summary: `订单 $${subtotal.toFixed(2)} (非美国地区，无额外费用)`
    });
  }
  
  // 美国地区：计算 8%税 + 2%保险
  const tax = subtotal * 0.08;      // 8% 税
  const insurance = subtotal * 0.02; // 2% 保险
  const total = subtotal + tax + insurance;
  
  res.json({
    success: true,
    region_info: {
      country: 'US',
      zip_code: userZipCode || '未指定',
      is_us: true,
      message: '美国地区适用: 8%税 + 2%保险'
    },
    input: { amount: subtotal.toFixed(2) },
    fees: {
      tax: { rate: '8%', amount: tax.toFixed(2) },
      insurance: { rate: '2%', amount: insurance.toFixed(2) }
    },
    totals: {
      subtotal: subtotal.toFixed(2),
      additional_fees: (tax + insurance).toFixed(2),
      total: total.toFixed(2)
    },
    summary: `美国订单 $${subtotal.toFixed(2)} + 8%税($${tax.toFixed(2)}) + 2%保险($${insurance.toFixed(2)}) = $${total.toFixed(2)}`
  });
});

// ============ 地区检测测试端点 ============
app.post('/check-region', (req, res) => {
  const { country, zipCode } = req.body;
  const isUS = isUSRegion(country, zipCode);
  
  res.json({
    country: country || '未提供',
    zip_code: zipCode || '未提供',
    is_us: isUS,
    message: isUS ? '美国地区 - 将应用费用规则' : '非美国地区 - 不应用额外费用',
    rules_applied: isUS ? '8%税 + 2%保险' : '无额外费用'
  });
});

// ============ 增强版测试页面 ============
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>地区智能费用计算器</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
        .card { background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 20px 0; }
        .tab { display: flex; margin-bottom: 20px; }
        .tab button { flex: 1; padding: 10px; border: none; background: #e9ecef; cursor: pointer; }
        .tab button.active { background: #007bff; color: white; }
        .region-badge { display: inline-block; padding: 5px 10px; border-radius: 20px; font-size: 14px; margin-left: 10px; }
        .us-badge { background: #28a745; color: white; }
        .non-us-badge { background: #6c757d; color: white; }
        input, select, button { padding: 12px; margin: 8px 0; width: 100%; box-sizing: border-box; }
        button { background: #007bff; color: white; border: none; cursor: pointer; }
        .result { background: #d4edda; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .fee-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .total { font-weight: bold; border-top: 2px solid #007bff; padding-top: 10px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <h1>地区智能费用计算器</h1>
      <p>专为 skullisjewelry.com 开发 | 规则: 仅美国地区收取 8%税 + 2%保险</p>
      
      <div class="tab">
        <button class="tab-btn active" onclick="switchTab('calculator')">💰 费用计算</button>
        <button class="tab-btn" onclick="switchTab('region')">🌐 地区检测</button>
      </div>
      
      <!-- 费用计算标签页 -->
      <div id="calculator-tab" class="tab-content">
        <div class="card">
          <h3>地区智能费用计算</h3>
          <div class="info">
            <strong>规则说明:</strong> 
            <ul>
              <li>美国地区: 收取 8%销售税 + 2%保险费</li>
              <li>其他地区: 不收取额外费用</li>
              <li>根据国家代码和邮编自动检测</li>
            </ul>
          </div>
          
          <label>订单金额 ($):</label>
          <input type="number" id="amount" value="100.00" step="0.01" min="0.01">
          
          <label>国家代码 (2位字母):</label>
          <select id="country">
            <option value="US">🇺🇸 美国 (US)</option>
            <option value="CA">🇨🇦 加拿大 (CA)</option>
            <option value="GB">🇬🇧 英国 (GB)</option>
            <option value="AU">🇦🇺 澳大利亚 (AU)</option>
            <option value="JP">🇯🇵 日本 (JP)</option>
            <option value="CN">🇨🇳 中国 (CN)</option>
            <option value="DE">🇩🇪 德国 (DE)</option>
            <option value="FR">🇫🇷 法国 (FR)</option>
            <option value="OTHER">其他地区</option>
          </select>
          
          <label>邮编/邮政编码 (可选):</label>
          <input type="text" id="zipCode" placeholder="例如: 10001 (美国邮编)" value="10001">
          
          <button onclick="calculateWithRegion()">智能计算费用</button>
          
          <div id="result" class="result" style="display:none;">
            <!-- 结果将显示在这里 -->
          </div>
        </div>
      </div>
      
      <!-- 地区检测标签页 -->
      <div id="region-tab" class="tab-content" style="display:none;">
        <div class="card">
          <h3>地区检测测试</h3>
          <p>测试不同地区的检测结果</p>
          
          <label>国家代码:</label>
          <select id="testCountry">
            <option value="US">US (美国)</option>
            <option value="CA">CA (加拿大)</option>
            <option value="GB">GB (英国)</option>
            <option value="JP">JP (日本)</option>
            <option value="AU">AU (澳大利亚)</option>
            <option value="">空值</option>
          </select>
          
          <label>邮编:</label>
          <input type="text" id="testZip" placeholder="输入邮编测试">
          
          <button onclick="testRegion()">检测地区</button>
          
          <div id="regionResult" style="margin-top: 20px;"></div>
        </div>
      </div>
      
      <script>
        // 切换标签页
        function switchTab(tabName) {
          document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
          document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
          
          document.getElementById(tabName + '-tab').style.display = 'block';
          event.target.classList.add('active');
        }
        
        // 费用计算
        async function calculateWithRegion() {
          const amount = document.getElementById('amount').value;
          const country = document.getElementById('country').value;
          const zipCode = document.getElementById('zipCode').value;
          
          const response = await fetch('/calculate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
              amount: amount,
              country: country,
              zipCode: zipCode
            })
          });
          
          const data = await response.json();
          const resultDiv = document.getElementById('result');
          
          if (data.error) {
            resultDiv.innerHTML = \`<p style="color: #dc3545;">❌ \${data.error}</p>\`;
          } else {
            const regionBadge = data.region_info.is_us ? 
              '<span class="region-badge us-badge">美国地区</span>' : 
              '<span class="region-badge non-us-badge">非美国地区</span>';
            
            let feesHtml = '';
            if (data.region_info.is_us) {
              feesHtml = \`
                <div class="fee-row">
                  <span>➕ 税费 (\${data.fees.tax.rate}):</span>
                  <span>\$\${data.fees.tax.amount}</span>
                </div>
                <div class="fee-row">
                  <span>➕ 保险费 (\${data.fees.insurance.rate}):</span>
                  <span>\$\${data.fees.insurance.amount}</span>
                </div>
              \`;
            }
            
            resultDiv.innerHTML = \`
              <h4>费用明细 \${regionBadge}</h4>
              <p><small>\${data.region_info.message}</small></p>
              <div class="fee-row">
                <span>订单金额:</span>
                <span>\$\${data.totals.subtotal}</span>
              </div>
              \${feesHtml}
              <div class="fee-row total">
                <span>💰 订单总计:</span>
                <span>\$\${data.totals.total}</span>
              </div>
              <p><small>\${data.summary}</small></p>
            \`;
          }
          resultDiv.style.display = 'block';
        }
        
        // 地区检测
        async function testRegion() {
          const country = document.getElementById('testCountry').value;
          const zipCode = document.getElementById('testZip').value;
          
          const response = await fetch('/check-region', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
              country: country,
              zipCode: zipCode
            })
          });
          
          const data = await response.json();
          const resultDiv = document.getElementById('regionResult');
          
          const badge = data.is_us ? 
            '<span class="region-badge us-badge">美国地区</span>' : 
            '<span class="region-badge non-us-badge">非美国地区</span>';
          
          resultDiv.innerHTML = \`
            <div class="card">
              <h4>地区检测结果</h4>
              <p><strong>国家:</strong> \${data.country}</p>
              <p><strong>邮编:</strong> \${data.zip_code}</p>
              <p><strong>检测结果:</strong> \${badge}</p>
              <p><strong>规则应用:</strong> \${data.rules_applied}</p>
              <p><em>\${data.message}</em></p>
            </div>
          \`;
        }
        
        // 页面加载时自动计算一次（美国示例）
        window.onload = calculateWithRegion;
      </script>
    </body>
    </html>
  `);
});

// ============ 首页 ============
app.get('/', (req, res) => {
  res.send(`
    <html>
    <body style="font-family: Arial; padding: 40px;">
      <h1>地区智能费用计算服务</h1>
      <p>版本 2.0 - 新增地区智能检测</p>
      <div style="background: #f0f8ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3>🚀 新功能：地区限制规则</h3>
        <ul>
          <li><strong>美国地区</strong>: 收取 8%销售税 + 2%保险费</li>
          <li><strong>其他地区</strong>: 无额外费用</li>
          <li><strong>自动检测</strong>: 根据国家代码和邮编判断</li>
        </ul>
      </div>
      <p><a href="/test">🧪 前往测试页面</a></p>
      <p><strong>API端点:</strong></p>
      <ul>
        <li>POST <code>/calculate</code> - 智能费用计算</li>
        <li>POST <code>/check-region</code> - 地区检测</li>
      </ul>
      <hr>
      <p>为 <strong>skullisjewelry.com</strong> 开发 | 地区限制: 仅美国</p>
    </body>
    </html>
  `);
});

// ============ 启动服务器 ============
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('地区智能费用计算服务器已启动');
  console.log('='.repeat(50));
  console.log('本地访问: http://localhost:' + PORT);
  console.log('测试页面: http://localhost:' + PORT + '/test');
  console.log('API端点:');
  console.log('   POST /calculate - 智能费用计算');
  console.log('   POST /check-region - 地区检测');
  console.log('='.repeat(50));
  console.log('核心业务逻辑:');
  console.log('   仅美国地区: 8%税 + 2%保险');
  console.log('   其他地区: 无额外费用');
  console.log('   自动地区检测');
  console.log('='.repeat(50));
});
