export async function onRequestPost(context) {
  // context chứa thông tin request và các biến môi trường (Environment Variables)
  const { request, env } = context;

  // 1. Lấy khóa bí mật đã giấu trên Cloudflare
  const API_KEY = env.API_KEY;
  const BASE_URL = env.BASE_URL; // VD: https://anyrouter.top
  const MODEL = env.MODEL;       // VD: gpt-5.3-codex

  if (!API_KEY || !BASE_URL) {
    return new Response(JSON.stringify({ error: "Server chưa cấu hình API Key" }), { status: 500 });
  }

  try {
    // 2. Nhận payload (prompt, ảnh reference...) từ file HTML gửi lên
    const payload = await request.json();
    
    // Ghi đè model từ biến môi trường (để tránh bị người dùng F12 sửa đổi)
    payload.model = MODEL || payload.model;

    // 3. Chuẩn bị request gửi lên API gốc
    // Đảm bảo BASE_URL không có dấu / ở cuối cùng để tránh lỗi /v1//responses
    const cleanBaseUrl = BASE_URL.replace(/\/+$/, '');
    const upstreamUrl = `${cleanBaseUrl}/v1/responses`;
    
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'accept': 'text/event-stream',
      // Thêm các header yêu cầu của upstream (từ code gốc của bạn)
      'version': '0.122.0',
      'originator': 'codex_cli_rs'
    };

    // 4. Bắn request lên API gốc
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    // 5. Trả thẳng luồng Stream (SSE) về cho file HTML
    // Cloudflare tự động bơm dữ liệu stream mượt mà về máy người dùng
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}