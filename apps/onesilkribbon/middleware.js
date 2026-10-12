import { adminMiddleware } from '@osr/core/lib/admin-middleware'

// 鉴权逻辑在 core 里，两个站共用一份，见 packages/core/lib/admin-middleware.js
export function middleware(request) {
  return adminMiddleware(request)
}

// 必须覆盖全部路径，不能只写 /admin 与 /api/admin：中间件要对每个请求清掉伪造的
// 管理员身份头，否则任何不在这里的路由一旦调用 verifyAdmin()，就能被一个请求头冒充。
// 非后台路径上中间件只删头、不发网络请求。只排除 _next 静态资源——它们到不了任何
// route handler。不要按文件扩展名排除：动态路由会把 /api/admin/xxx.png 匹配进来。
export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
