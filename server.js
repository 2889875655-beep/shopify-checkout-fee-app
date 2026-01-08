const express = require('express');
const app = express();

// 解析 JSON 请求
app.use(express.json());

const PORT = 3000;

// ============ 你的核心业务逻辑 ============
// 功能：计算 8%税 + 2%保险
app.post('/calculate', (req, res) => {
  const { amount } = req.body;
  
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ 
      error: '请输入有效的正数金额',
      example: { "amount": 100.50 }
    });
  }
  
  const subtotal = parseFloat(amount);
  const tax = subtotal * 0.08;      // 8% 税
  const insurance = subtotal * 0.02; // 2% 保险
  const total = subtotal + tax + insurance;
  
  res.json({
    success: true,
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
    summary: `订单 $${subtotal.toFixed(2)} + 8%税($${tax.toFixed(2)}) + 2%保险($${insurance.toFixed(2)}) = $${total.toFixed(2)}`
  });
});

// ============ 测试页面 ============
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>费用计算器</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
        .card { background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 20px 0; }
        input, button { padding: 12px; margin: 8px 0; width: 100%; box-sizing: border-box; }
        button { background: #28a745; color: white; border: none; cursor: pointer; }
        .result { background: #d4edda; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .fee-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .total { font-weight: bold; border-top: 2px solid #28a745; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>💰 订单费用计算器</h1>
      <p>专为 skullisjewelry.com 开发</p>
      
      <div class="card">
        <h3>测试计算功能</h3>
        <label>订单金额 ($):</label>
        <input type="number" id="amount" value="100.00" step="0.01" min="0.01">
        <button onclick="calculate()">计算 8%税 + 2%保险</button>
        
        <div id="result" class="result" style="display:none;">
          <!-- 结果将显示在这里 -->
        </div>
      </div>
      
      <script>
        async function calculate() {
          const amount = document.getElementById('amount').value;
          const response = await fetch('/calculate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: amount })
          });
          
          const data = await response.json();
          const resultDiv = document.getElementById('result');
          
          if (data.error) {
            resultDiv.innerHTML = \`<p style="color: #dc3545;">❌ \${data.error}</p>\`;
          } else {
            resultDiv.innerHTML = \`
              <h4>📋 费用明细</h4>
              <div class="fee-row">
                <span>订单金额:</span>
                <span>\$\${data.totals.subtotal}</span>
              </div>
              <div class="fee-row">
                <span>➕ 税费 (\${data.fees.tax.rate}):</span>
                <span>\$\${data.fees.tax.amount}</span>
              </div>
              <div class="fee-row">
                <span>➕ 保险费 (\${data.fees.insurance.rate}):</span>
                <span>\$\${data.fees.insurance.amount}</span>
              </div>
              <div class="fee-row total">
                <span>💰 订单总计:</span>
                <span>\$\${data.totals.total}</span>
              </div>
              <p><small>\${data.summary}</small></p>
            \`;
          }
          resultDiv.style.display = 'block';
        }
        
        // 页面加载时自动计算一次
        window.onload = calculate;
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
      <h1>✅ 订单费用计算服务</h1>
      <p>简化版本 - 专注于核心业务逻辑</p>
      <p><strong>功能:</strong> 自动计算 8%销售税 + 2%保险费</p>
      <p><a href="/test">🧪 前往测试页面</a></p>
      <p>API: POST /calculate (JSON: {"amount": 100.50})</p>
      <hr>
      <p>为 <strong>skullisjewelry.com</strong> 开发</p>
    </body>
    </html>
  `);
});

// ============ 启动服务器 ============
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('✅ 费用计算服务器已启动');
  console.log('='.repeat(50));
  console.log('🌐 本地访问: http://localhost:' + PORT);
  console.log('🧪 测试页面: http://localhost:' + PORT + '/test');
  console.log('📡 API端点: POST http://localhost:' + PORT + '/calculate');
  console.log('='.repeat(50));
  console.log('🎯 核心业务逻辑:');
  console.log('   1. 8% 销售税计算');
  console.log('   2. 2% 保险费计算');
  console.log('   3. 总计金额计算');
  console.log('='.repeat(50));
});
