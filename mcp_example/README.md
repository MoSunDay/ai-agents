# MCP 时间服务器示例

这是一个简单的 MCP (Model Context Protocol) 服务器示例，提供时间相关的工具和资源。

## 功能特性

### 🔧 工具 (Tools)
- `get_current_time(format)` - 获取当前时间，支持自定义格式
- `get_timestamp()` - 获取当前 Unix 时间戳
- `get_time_info()` - 获取详细的时间信息（包含多种格式）

### 📚 资源 (Resources)
- `time://current` - 当前时间资源

### 💬 提示词 (Prompts)
- `time_prompt(action)` - 时间相关的提示词模板

## 安装依赖

```bash
cd mcp_example
pip install -r requirements.txt
```

## 使用方法

### 1. 直接运行服务器（stdio 模式）
```bash
python time_server.py stdio
```

### 2. 运行测试客户端
```bash
python test_client.py
```

### 3. 在主项目中使用

修改后端的 `handler.py` 文件，在 `mcp_servers` 配置中添加：

```python
self.mcp_servers = {
    "time_server": {
        "command": "python",
        "args": ["/path/to/mcp_example/time_server.py", "stdio"],
        "description": "时间工具服务器"
    },
    # ... 其他服务器
}
```

然后在数据库中添加对应的 MCP 工具记录。

## 示例输出

运行测试客户端后，你会看到类似以下的输出：

```
🚀 启动 MCP 时间服务器测试...
📡 初始化连接...
✅ 连接成功！

🔧 获取可用工具...
可用工具数量: 3
  - get_current_time: 获取当前时间
  - get_timestamp: 获取当前时间戳
  - get_time_info: 获取详细的时间信息

📚 获取可用资源...
可用资源数量: 1
  - time://current: 

💬 获取可用提示词...
可用提示词数量: 1
  - time_prompt: 时间相关的提示词

🧪 测试工具调用...
1. 获取当前时间:
   结果: {"result": "2025-08-07 23:50:15"}

2. 获取时间戳:
   结果: {"result": 1723047015.123456}

3. 获取详细时间信息:
   结构化结果: {"datetime": "2025-08-07 23:50:15", "date": "2025-08-07", ...}

4. 获取自定义格式时间:
   结果: {"result": "2025年08月07日 23时50分15秒"}

🎉 测试完成！
```

## 集成到主项目

1. 确保 MCP 服务器可以独立运行
2. 在后端配置中添加服务器信息
3. 在数据库中创建对应的工具记录
4. 在 Agent 中绑定时间工具
5. 通过聊天界面测试功能

## 扩展建议

- 添加时区转换功能
- 添加日期计算工具（如计算两个日期之间的差值）
- 添加定时提醒功能
- 支持多种日历系统（农历、伊斯兰历等）
