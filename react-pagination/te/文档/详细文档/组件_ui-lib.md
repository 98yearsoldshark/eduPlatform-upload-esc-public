# UI 组件库 (ui-lib) 详细文档

`ui-lib` 是 ChatGPT-Next-Web 项目的自定义 UI 组件库，为整个应用提供了统一的界面元素和交互组件。该库包含了从简单的按钮到复杂的模态框等多种组件，所有组件都支持主题切换并遵循一致的设计语言。

## 文件位置

```
/app/components/ui-lib.tsx  // UI组件定义
/app/components/ui-lib.module.scss  // 样式定义
```

## 组件概览

UI 库包含以下主要组件类型：

1. **基础组件** - 按钮、输入框、选择器等
2. **容器组件** - 卡片、列表、分组等 
3. **反馈组件** - 提示框、加载指示器等
4. **弹出组件** - 模态框、弹出菜单等
5. **特殊组件** - 主题切换器、滑块等

## 主要组件详解

### 1. Selector (选择器)

```tsx
export function Selector<T>(props: {
  value: T;
  onChange: (value: T) => void;
  list: {
    name: string;
    value: T;
    disabled?: boolean;
  }[];
  className?: string;
}) {
  return (
    <div className={styles["selector"] + " " + props.className}>
      {props.list.map((item, i) => (
        <div
          key={i}
          className={`${styles["selector-item"]} ${
            item.value === props.value && styles["selected"]
          } ${item.disabled && styles["disabled"]}`}
          onClick={() => {
            if (!item.disabled) props.onChange(item.value);
          }}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

用途：提供一组可选项，用户可以选择其中一个选项。主要用于设置页面的选项选择。

### 2. Modal (模态框)

```tsx
export function Modal(props: {
  title: string;
  children?: JSX.Element | string;
  actions?: JSX.Element[];
  onClose?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  return (
    <div className={styles["modal-container"]}>
      <div className={styles["modal-header"]}>
        <div className={styles["modal-title"]}>{props.title}</div>
        <div className={styles["modal-close-btn"]} onClick={props.onClose}>
          <CloseIcon />
        </div>
      </div>

      <div className={styles["modal-content"]}>{props.children}</div>

      <div className={styles["modal-footer"]}>
        <div className={styles["modal-actions"]}>
          {props.actions?.map((action, i) => (
            <div key={i} className={styles["modal-action"]}>
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

用途：显示模态对话框，包含标题、内容和操作按钮。支持ESC键关闭。

### 3. List (列表)

```tsx
export function List(props: { children: ReactNode[] }) {
  return (
    <div className={styles["list"]}>
      {props.children.map((child, i) => (
        <div key={i} className={styles["list-item"]}>
          {child}
        </div>
      ))}
    </div>
  );
}
```

用途：显示一系列垂直排列的项目，常用于设置页面。

### 4. Popover (弹出框)

```tsx
export function Popover(props: {
  children: ReactNode;
  content: ReactNode;
  open?: boolean;
  onClose?: () => void;
}) {
  // 实现代码...
}
```

用途：在点击元素上方显示弹出内容，如提示信息或上下文菜单。

### 5. Card (卡片)

```tsx
export function Card(props: {
  children: JSX.Element | string;
  className?: string;
}) {
  return (
    <div className={styles["card"] + " " + props.className}>
      {props.children}
    </div>
  );
}
```

用途：以卡片形式呈现内容，提供阴影和边框效果。

### 6. 对话框组件

项目提供了一系列便捷的对话框函数:

```tsx
export function showConfirm(content: string) {
  const div = document.createElement("div");
  div.className = "modal-mask";
  document.body.appendChild(div);

  const root = createRoot(div);
  return new Promise<boolean>((resolve) => {
    root.render(
      <Modal
        title={Locale.UI.Confirm}
        actions={[
          <IconButton
            key="cancel"
            text={Locale.UI.Cancel}
            onClick={() => {
              resolve(false);
              root.unmount();
              div.remove();
            }}
            bordered
            icon={<CloseIcon />}
          />,
          <IconButton
            key="confirm"
            text={Locale.UI.Confirm}
            type="primary"
            onClick={() => {
              resolve(true);
              root.unmount();
              div.remove();
            }}
            icon={<ConfirmIcon />}
          />,
        ]}
        onClose={() => {
          resolve(false);
          root.unmount();
          div.remove();
        }}
      >
        <div style={{ minWidth: "200px" }}>{content}</div>
      </Modal>,
    );
  });
}
```

类似的还有：
- `showPrompt`: 显示输入对话框
- `showToast`: 显示提示消息
- `showImageModal`: 显示图片预览

### 7. 输入组件

```tsx
export function Input(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  readonly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      className={`${styles["input"]} ${props.className}`}
      type={props.type || "text"}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      readOnly={props.readonly}
      style={props.style}
    ></input>
  );
}
```

用途：提供输入文本的界面元素，支持只读模式和不同类型的输入。

## 样式系统

UI库使用CSS Modules实现样式隔离，主要风格定义在 `ui-lib.module.scss` 中:

```scss
.card {
  background-color: var(--white);
  border-radius: 10px;
  box-shadow: var(--card-shadow);
  padding: 10px;
}

.popover {
  position: relative;
  display: inline-block;
  
  .popover-content {
    position: absolute;
    animation: slide-in 0.3s ease;
    // 其他样式...
  }
}

// 更多样式定义...
```

### 主题支持

组件支持亮色和暗色主题，通过CSS变量实现:

```scss
:root {
  --white: #fff;
  --black: #000;
  --primary: #4aa181;
  // 亮色模式的其他变量...
}

:root.dark {
  --white: #1f1f1f;
  --black: #fff;
  --primary: #4aa181;
  // 暗色模式的其他变量...
}
```

## 使用示例

### 基本使用

```tsx
import { List, ListItem, Input, Modal, IconButton } from "./ui-lib";

function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  
  return (
    <List>
      <ListItem title="API Key">
        <Input 
          value={apiKey} 
          onChange={setApiKey} 
          placeholder="请输入OpenAI API Key" 
        />
      </ListItem>
      {/* 其他设置项 */}
    </List>
  );
}
```

### 显示对话框

```tsx
import { showConfirm, showToast } from "./ui-lib";

async function handleDelete() {
  const confirmed = await showConfirm("确定要删除此会话吗？");
  if (confirmed) {
    // 执行删除操作
    showToast("已删除");
  }
}
```

## 自定义和扩展

UI库设计为可扩展的，可以通过以下方式自定义:

### 1. 样式覆盖

```scss
/* 在自定义SCSS文件中 */
.custom-modal {
  :global(.modal-container) {
    max-width: 800px;
    background-color: var(--custom-bg);
  }
}
```

### 2. 组件封装

```tsx
function CustomButton(props: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <IconButton
      icon={<MyCustomIcon />}
      text={props.children}
      onClick={props.onClick}
      className="my-custom-button"
    />
  );
}
```

## 无障碍性

UI库实现了基本的无障碍支持:

- 键盘导航: 模态框支持Escape键关闭
- 语义HTML: 使用适当的HTML元素和ARIA属性
- 颜色对比度: 符合WCAG AA级标准

```tsx
// 无障碍示例
<button 
  className={styles.button}
  onClick={props.onClick}
  disabled={props.disabled}
  aria-label={props.ariaLabel}
  role={props.role}
>
  {props.children}
</button>
```

## 响应式设计

UI组件支持响应式布局，适应不同屏幕尺寸:

```scss
@media screen and (max-width: 600px) {
  .modal-container {
    width: 90%;
    max-width: 90%;
  }
  
  .selector {
    flex-direction: column;
  }
}
```

## 动画效果

UI库包含多种动画效果，提升用户体验:

```scss
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-container {
  animation: slide-in 0.3s ease;
}
```

## 与其他模块的集成

UI库与项目的其他模块紧密集成:

1. **与主题系统集成**: 通过 `useAppConfig` 获取当前主题
2. **与国际化系统集成**: 使用 `Locale` 对象获取翻译文本
3. **与状态管理集成**: 通过各种状态hooks获取和更新状态

```tsx
import { Locale } from "../locales";
import { useAppConfig } from "../store";

function ThemeSelector() {
  const config = useAppConfig();
  const theme = config.theme;
  
  return (
    <ListItem title={Locale.Settings.Theme}>
      <Select
        value={theme}
        onChange={(theme) => config.update((config) => (config.theme = theme))}
        options={[
          { value: "auto", label: Locale.Settings.ThemeAuto },
          { value: "light", label: Locale.Settings.ThemeLight },
          { value: "dark", label: Locale.Settings.ThemeDark },
        ]}
      />
    </ListItem>
  );
}
```

## 性能考虑

UI库在设计时考虑了性能优化:

1. **组件懒加载**: 复杂组件使用动态导入
2. **条件渲染**: 只在需要时渲染复杂组件
3. **事件委托**: 减少事件监听器数量
4. **CSS优化**: 避免复杂的CSS选择器

```tsx
// 懒加载示例
const LazyModal = dynamic(() => import("./components/ui-lib").then(mod => mod.Modal), {
  loading: () => <Loading />,
  ssr: false,
});
```

## 最佳实践

使用UI库时的一些最佳实践:

1. **保持简单**: 避免过度使用复杂组件
2. **一致性**: 使用相同的组件处理相似的用户界面需求
3. **主题适配**: 使用CSS变量而非硬编码颜色
4. **响应式设计**: 确保在各种设备上正常工作

## 常见问题和解决方案

1. **样式冲突**: 使用CSS Modules隔离样式
2. **模态框层级**: 使用合适的z-index确保正确显示
3. **动画性能**: 使用transform和opacity进行动画，避免布局重新计算

UI库是整个应用的基础，为用户提供一致、美观且功能丰富的界面元素。通过这套组件库，应用保持了统一的设计语言和用户体验，同时也提高了开发效率和代码可维护性。
