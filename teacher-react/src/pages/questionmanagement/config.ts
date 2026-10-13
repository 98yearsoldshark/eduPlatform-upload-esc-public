// MathJax配置
export const mathJaxConfig = {
  loader: { load: ["[tex]/ams"] },
  tex: {
    packages: {"[+]": ["ams"]},
    inlineMath: [["$", "$"]],
    displayMath: [["$$", "$$"]]
  },
  startup: {
    typeset: false, // 禁用自动排版，我们将手动控制
    ready: () => {
      // 初始化后才排版
      // @ts-ignore - MathJax在Window上会被动态添加
      if (window.MathJax && window.MathJax.startup) {
        // @ts-ignore
        window.MathJax.startup.defaultReady();
      }
    }
  },
  options: {
    enableMenu: false, // 禁用右键菜单
    renderActions: {
      addMenu: [], // 禁用右键菜单的另一个设置
    },
    safeOptions: {
      allow: {
        URLs: 'safe',
        classes: 'safe',
        cssIDs: 'safe',
        styles: 'safe'
      }
    }
  }
}; 