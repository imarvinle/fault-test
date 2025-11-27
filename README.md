# Fault Test - Echo API 管理工具

一个基于 Next.js 的 Echo API 管理工具，可以配置 API 的延迟和失败率，用于测试和故障注入。

## 功能特性

- ✅ Echo API：支持 GET 和 POST 请求的回声接口
- ⚙️ 可配置延迟：设置 API 响应的延迟时间
- 🎲 可配置失败率：设置 API 返回 500 错误的概率
- 🎨 管理界面：友好的 Web 界面进行配置管理
- 🧪 测试功能：在管理页面直接测试 Echo API

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看管理页面。

## API 接口

### Echo API

- **GET /api/echo** - 回声 GET 请求
- **POST /api/echo** - 回声 POST 请求

### 配置管理 API

- **GET /api/config** - 获取当前配置
- **POST /api/config** - 更新配置

请求体示例：
```json
{
  "delay": 1000,
  "failureRate": 20
}
```

## 使用示例

### 测试 Echo API

```bash
# GET 请求
curl http://localhost:3000/api/echo?test=1&message=hello

# POST 请求
curl -X POST http://localhost:3000/api/echo \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 更新配置

```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"delay": 2000, "failureRate": 30}'
```

## 技术栈

- Next.js 14
- TypeScript
- React 18

