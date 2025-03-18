async function handleWebSocket(req: Request): Promise<Response> {
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  const url = new URL(req.url);
  const targetUrl = `wss://generativelanguage.googleapis.com${url.pathname}${url.search}`;

  console.log('Target URL:', targetUrl);

  const pendingMessages: string[] = [];
  const targetWs = new WebSocket(targetUrl);

  targetWs.onopen = () => {
    console.log('Connected to Gemini');
    pendingMessages.forEach(msg => targetWs.send(msg));
    pendingMessages.length = 0;
  };

  clientWs.onmessage = (event) => {
    console.log('Client message received');
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(event.data);
    } else {
      pendingMessages.push(event.data);
    }
  };

  targetWs.onmessage = (event) => {
    console.log('Gemini message received');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(event.data);
    }
  };

  clientWs.onclose = (event) => {
    console.log('Client connection closed');
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.close(1000, event.reason);
    }
  };

  targetWs.onclose = (event) => {
    console.log('Gemini connection closed');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(event.code, event.reason);
    }
  };

  targetWs.onerror = (error) => {
    console.error('Gemini WebSocket error:', error);
  };

  return response;
}

async function handleAPIRequest(req: Request): Promise<Response> {
  try {
    const worker = await import('./api_proxy/worker.mjs');
    return await worker.default.fetch(req);
  } catch (error) {
    console.error('API request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStatus = (error as { status?: number }).status || 500;
    return new Response(errorMessage, {
      status: errorStatus,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    });
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log('Request URL:', req.url);

  // WebSocket 处理
  if (req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }

  if (url.pathname.endsWith("/chat/completions") ||
    url.pathname.endsWith("/embeddings") ||
    url.pathname.endsWith("/models")) {
    return handleAPIRequest(req);
  }

  // 处理 Gemini API 的 generateContent 请求
  if (url.pathname.includes(":generateContent")) {
    console.log('Handling generateContent request:', url.pathname);
    
    // 提取模型名称和请求路径
    const modelPath = url.pathname.split('/v1beta/')[1];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}`;
    
    // 获取授权头
    const authHeader = req.headers.get("Authorization");
    
    // 创建请求选项
    const options: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    
    // 如果有授权头，则添加到请求中
    if (authHeader) {
      const apiKey = authHeader.split(" ")[1];
      const url = new URL(apiUrl);
      url.searchParams.append("key", apiKey);
      
      // 转发请求体
      if (req.method !== "GET" && req.method !== "HEAD") {
        options.body = await req.text();
      }
      
      try {
        console.log(`Forwarding request to: ${url.toString()}`);
        const response = await fetch(url.toString(), options);
        const responseData = await response.text();
        console.log(`Response status: ${response.status}`);
        console.log(`Response data length: ${responseData.length}`);
        
        // 返回响应
        return new Response(responseData, {
          status: response.status,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("Error forwarding request:", error);
        return new Response(JSON.stringify({ error: "Error forwarding request" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

  return new Response('ok');
}

Deno.serve(handleRequest); 
