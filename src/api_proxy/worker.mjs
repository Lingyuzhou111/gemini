// 定义Gemini API的基础URL
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// 处理跨域请求的配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  // 添加额外的安全头
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '0'
};

// 处理OPTIONS请求的函数
function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders,
  });
}

// 处理实际请求的函数
async function handleRequest(request) {
  try {
    // 获取原始URL中的路径和参数
    const url = new URL(request.url);
    const path = url.pathname;
    const apiKey = url.searchParams.get('key');

    if (!apiKey) {
      return new Response('API key is required', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // 构建转发到Gemini API的URL
    const targetUrl = `${GEMINI_BASE_URL}${path}?key=${apiKey}`;
    
    // 创建新的请求头
    const headers = new Headers(request.headers);
    headers.set('Content-Type', 'application/json');

    // 转发请求到Gemini API
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });

    // 创建新的响应头，包含CORS配置
    const responseHeaders = new Headers(response.headers);
    Object.keys(corsHeaders).forEach(key => {
      responseHeaders.set(key, corsHeaders[key]);
    });

    // 返回响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Request handling error:', err);
    return new Response(`Error: ${err.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}

// 处理所有请求的主函数
export default {
  async fetch(request, env, ctx) {
    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // 处理实际请求
    try {
      return await handleRequest(request);
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
