/*******************************************************************************
 * 地区智能费用计算 Shopify 应用
 * 功能：当美国地址下单时，自动添加 8%销售税 + 2%保险费
 * 作者：为 skullisjewelry.com 定制开发
 ******************************************************************************/

const express = require('express');
const { shopifyApi, LATEST_API_VERSION, Session } = require('@shopify/shopify-api');
const { MemorySessionStorage } = require('@shopify/shopify-app-session-storage-memory');
require('dotenv').config();

// ==================== 初始化 Express ====================
const app = express();
app.use(express.json());

// ==================== Shopify API 配置 ====================
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders', 'write_orders'],
  hostName: process.env.HOST?.replace(/https?:\/\//, ''),
  hostScheme: 'https',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  sessionStorage: new MemorySessionStorage(),
});

// ==================== 内存存储（生产环境请替换为数据库） ====================
const shopStorage = new Map();

async function saveShopSession(shop, accessToken) {
  shopStorage.set(shop, {
    accessToken,
    installedAt: new Date().toISOString()
  });
  console.log(`✅ 店铺 ${shop} 的访问令牌已保存`);
}

async function getShopSession(shop) {
  return shopStorage.get(shop);
}

// ==================== 地区检测函数（你的原有逻辑） ====================
const isUSRegion = (countryCode, zipCode) => {
  if (!countryCode) return false;
  const country = countryCode.toUpperCase();
  if (country !== 'US') return false;
  
  if (zipCode) {
    const usZipRegex = /^\d{5}(-\d{4})?$/;
    return usZipRegex.test(zipCode);
  }
  return true;
};

// ==================== Shopify OAuth 授权路由 ====================
app.get('/auth', async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).send('缺少店铺参数，请提供 ?shop=your-store.myshopify.com');
    }

    console.log(`🔄 开始安装流程，店铺：${shop}`);
    
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
    
    res.redirect(authRoute);
  } catch (error) {
    console.error('❌ OAuth 初始化失败:', error);
    res.status(500).send('OAuth 初始化失败: ' + error.message);
  }
});

app.get('/auth/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { shop, accessToken } = callback.session;
    
    // 保存访问令牌
    await saveShopSession(shop, accessToken);
    
    console.log(`🎉 应用成功安装到店铺：${shop}`);
    
    // 注册 Webhook
    await registerWebhook(shop, accessToken);
    
    // 重定向回 Shopify 后台
    res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
  } catch (error) {
    console.error('❌ OAuth 回调失败:', error);
    res.status(500).send(`<h1>安装失败</h1><p>${error.message}</p><p><a href="/">返回首页</a></p>`);
  }
});

//======================在 server.js 中添加==================
app.get('/checkout-fee-display.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  // 直接返回上面的脚本内容，或从文件读取
  res.send(fs.readFileSync('./checkout-fee-display.js', 'utf8'));
});

// ==================== Webhook 注册函数 ====================
async function registerWebhook(shop, accessToken) {
  try {
    const webhookAddress = `${process.env.HOST}/webhooks/orders_create`;
    
    const response = await fetch(`https://${shop}/admin/api/2026-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          topic: 'orders/create',
          address: webhookAddress,
          format: 'json'
        }
      })
    });

    if (response.ok) {
      console.log(`✅ 已为 ${shop} 注册 orders/create Webhook`);
    } else {
      const error = await response.text();
      console.error(`❌ Webhook 注册失败 (${shop}):`, error);
    }
  } catch (error) {
    console.error(`❌ Webhook 注册异常 (${shop}):`, error.message);
  }
}

// ==================== 核心：订单创建 Webhook 处理 ====================
app.post('/webhooks/orders_create', express.json(), async (req, res) => {
  console.log('📦 收到订单创建 Webhook');
  
  try {
    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      console.error('❌ 缺少店铺域名头部');
      return res.status(400).send('Missing shop domain');
    }

    console.log(`  店铺: ${shop}, 订单号: ${order.order_number || order.id}`);
    
    // 1. 获取访问令牌
    const session = await getShopSession(shop);
    if (!session || !session.accessToken) {
      console.error(`❌ 找不到店铺 ${shop} 的访问令牌`);
      return res.status(500).send('Shop not authenticated');
    }

    // 2. 提取地址信息
    const address = order.shipping_address || order.billing_address;
    const countryCode = address?.country_code;
    const zipCode = address?.zip;
    
    console.log(`  收货地址: ${countryCode}, ${zipCode}`);
    
    // 3. 使用你的原有逻辑判断是否为美国地址
    const isUS = isUSRegion(countryCode, zipCode);
    
    if (!isUS) {
      console.log(`  ⏩ 非美国地址 (${countryCode})，跳过费用添加`);
      return res.status(200).json({ 
        status: 'skipped',
        reason: '非美国地址',
        country: countryCode 
      });
    }
    
    // 4. 计算费用（重用你的原有逻辑）
    const subtotal = parseFloat(order.subtotal_price || order.current_subtotal_price || '0');
    const taxAmount = subtotal * 0.08;      // 8% 销售税
    const insuranceAmount = subtotal * 0.02; // 2% 保险费
    const totalFee = taxAmount + insuranceAmount;
    
    console.log(`  🇺🇸 美国订单检测：小计$${subtotal.toFixed(2)}，添加费用$${totalFee.toFixed(2)}`);
    
    // 5. 调用 Shopify API 添加交易记录（即添加费用）
    const transactionResponse = await fetch(
      `https://${shop}/admin/api/2026-01/orders/${order.id}/transactions.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          transaction: {
            currency: order.currency || 'USD',
            amount: totalFee.toFixed(2),
            kind: 'sale',
            source: 'external',
            gateway: 'manual',
            note: `US Sales Tax (8%): $${taxAmount.toFixed(2)} + Insurance (2%): $${insuranceAmount.toFixed(2)}`
          }
        })
      }
    );

    if (transactionResponse.ok) {
      console.log(`  ✅ 成功为订单 #${order.order_number} 添加费用`);
      res.status(200).json({ 
        status: 'success',
        message: '费用已添加',
        fees: {
          tax: taxAmount.toFixed(2),
          insurance: insuranceAmount.toFixed(2),
          total: totalFee.toFixed(2)
        }
      });
    } else {
      const errorText = await transactionResponse.text();
      console.error(`  ❌ 添加费用失败:`, errorText);
      res.status(500).json({ 
        status: 'error',
        message: 'Failed to add fee',
        error: errorText 
      });
    }
    
  } catch (error) {
    console.error('💥 Webhook 处理异常:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// ==================== 你的原有 API 端点（保持不变） ====================
app.post('/calculate', (req, res) => {
  const { amount, country, zipCode } = req.body;
  
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ 
      error: '请输入有效的正数金额',
      example: { "amount": 100.50 }
    });
  }
  
  const subtotal = parseFloat(amount);
  const isUS = isUSRegion(country, zipCode);
  
  if (!isUS) {
    return res.json({
      success: true,
      region_info: {
        country: country || '未指定',
        zip_code: zipCode || '未指定',
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
  
  const tax = subtotal * 0.08;
  const insurance = subtotal * 0.02;
  const total = subtotal + tax + insurance;
  
  res.json({
    success: true,
    region_info: {
      country: 'US',
      zip_code: zipCode || '未指定',
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

// ==================== 应用主页 ====================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>地区智能费用计算 Shopify 应用</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; padding: 40px; border-radius: 10px; margin-bottom: 30px; }
        .card { background: white; border-radius: 10px; padding: 25px; margin: 20px 0; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .btn { display: inline-block; background: #667eea; color: white; 
               padding: 12px 24px; border-radius: 5px; text-decoration: none; 
               font-weight: bold; margin: 10px 5px; }
        .btn-secondary { background: #6c757d; }
        .feature { display: flex; align-items: center; margin: 15px 0; }
        .feature-icon { font-size: 24px; margin-right: 15px; }
        .code { background: #f8f9fa; padding: 15px; border-radius: 5px; 
                font-family: 'Courier New', monospace; margin: 10px 0; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .status-success { background: #d4edda; color: #155724; }
        .status-info { background: #d1ecf1; color: #0c5460; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🇺🇸 地区智能费用计算</h1>
        <p>专为 skullisjewelry.com 定制开发的 Shopify 应用</p>
        <p>版本 2.0 - 完全集成 Shopify 平台</p>
      </div>
      
      <div class="card">
        <h2>🚀 核心功能</h2>
        <div class="feature">
          <div class="feature-icon">🔍</div>
          <div>
            <strong>智能地区检测</strong>
            <p>自动识别美国地址，精准应用费用规则</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">💰</div>
          <div>
            <strong>自动费用计算</strong>
            <p>美国地区：8%销售税 + 2%保险费</p>
            <p>其他地区：无额外费用</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <div>
            <strong>实时处理</strong>
            <p>订单创建时自动添加费用，无需人工操作</p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2>📊 费用规则</h2>
        <div class="status status-success">
          <strong>美国地区 (US)</strong>
          <p>✅ 收取 8%销售税 + 2%保险费</p>
          <p>📍 根据国家代码和邮编自动检测</p>
        </div>
        <div class="status status-info">
          <strong>其他地区</strong>
          <p>✅ 不收取任何额外费用</p>
        </div>
      </div>
      
      <div class="card">
        <h2>🔧 安装与测试</h2>
        <p>将此应用安装到您的 Shopify 商店：</p>
        <div class="code">
          https://${process.env.HOST}/auth?shop=your-store.myshopify.com
        </div>
        
        <a href="/test" class="btn">🧪 测试费用计算</a>
        <a href="/check-region" class="btn btn-secondary">🌐 测试地区检测</a>
        
        <p style="margin-top: 20px;">
          <strong>API 端点：</strong>
          <br>POST <code>/calculate</code> - 智能费用计算
          <br>POST <code>/check-region</code> - 地区检测
          <br>POST <code>/webhooks/orders_create</code> - Shopify Webhook
        </p>
      </div>
      
      <div class="card">
        <h2>📈 当前状态</h2>
        <p>✅ 地区检测逻辑已就绪</p>
        <p>✅ 费用计算 API 已就绪</p>
        <p>✅ Shopify OAuth 集成已就绪</p>
        <p>✅ Webhook 处理已就绪</p>
        <p>🔄 等待安装到 Shopify 商店</p>
      </div>
      
      <div class="card">
        <h2>📝 技术信息</h2>
        <p><strong>应用类型：</strong> Shopify 私有定制应用</p>
        <p><strong>目标客户：</strong> skullisjewelry.com</p>
        <p><strong>部署平台：</strong> Vercel</p>
        <p><strong>技术栈：</strong> Node.js, Express, Shopify API</p>
        <p><strong>数据存储：</strong> 内存存储（单店铺适用）</p>
      </div>
      
      <footer style="text-align: center; margin-top: 40px; color: #6c757d; font-size: 0.9em;">
        <p>© 2025 地区智能费用计算应用 - 为 skullisjewelry.com 定制开发</p>
        <p>注意：此应用仅适用于美国地区的订单处理</p>
      </footer>
    </body>
    </html>
  `);
});

// ==================== 你的原有测试页面 ====================
app.get('/test', (req, res) => {
  // 你的原有测试页面 HTML 代码（保持原样）
  // 由于篇幅限制，这里省略，你可以直接复制你原来的 /test 路由代码
  res.send('测试页面 - 请使用你原有的测试页面代码');
});

// ==================== 健康检查端点 ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      region_detection: true,
      fee_calculation: true,
      shopify_integration: true,
      webhook_processing: true
    }
  });
});

// ==================== 启动服务器 ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 地区智能费用计算 Shopify 应用已启动');
  console.log('='.repeat(60));
  console.log(`本地地址: http://localhost:${PORT}`);
  console.log(`部署地址: ${process.env.HOST}`);
  console.log('='.repeat(60));
  console.log('🔑 Shopify 配置:');
  console.log(`   API Key: ${process.env.SHOPIFY_API_KEY?.substring(0, 10)}...`);
  console.log(`   作用域: ${process.env.SHOPIFY_SCOPES}`);
  console.log('='.repeat(60));
  console.log('🛠️  可用路由:');
  console.log('   GET  /                    - 应用主页');
  console.log('   GET  /auth?shop=...      - 安装应用到 Shopify');
  console.log('   GET  /test               - 测试页面');
  console.log('   POST /calculate          - 费用计算 API');
  console.log('   POST /check-region       - 地区检测 API');
  console.log('   POST /webhooks/orders_create - Shopify Webhook');
  console.log('='.repeat(60));
  console.log('💡 安装说明:');
  console.log(`   1. 访问 ${process.env.HOST}/auth?shop=skullisjewelry.myshopify.com`);
  console.log('   2. 在 Shopify 后台完成授权');
  console.log('   3. 应用将自动开始处理订单');
  console.log('='.repeat(60));
});
