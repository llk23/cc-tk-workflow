# 编码规范

## TypeScript
- 使用 `strict` 模式
- 禁止 `any` 类型（用 `unknown` 替代后做类型守卫）
- 接口命名：`I{Name}` 或 `{Name}Interface`
- 类型命名：`{Name}Type` 或直接用 `type`
- 枚举命名：`{Name}Enum`

## 文件命名
- 包名: `@tk-workflow/{name}` (例如 `@tk-workflow/core`)
- 文件: 小写 kebab-case (例如 `base-node.ts`)
- 类名: PascalCase (例如 `BaseNode`)
- 函数名: camelCase (例如 `executePipeline`)

## 模块规范
- 每个包有独立的 `package.json`, `tsconfig.json`
- 入口文件统一为 `src/index.ts` 或 `src/main.ts`
- 测试文件放在 `test/` 目录或 `.test.ts` 后缀

## 错误处理
- 所有异步操作必须 try-catch
- 自定义错误继承 `AppError` 基类
- 节点执行错误必须记录到 Context Store
