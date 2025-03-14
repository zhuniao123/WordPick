# 生词本助手 (Vocabulary Helper)

一个用于帮助用户收集和管理生词的浏览器扩展工具。

## 功能特点

- 选中单词后快速添加到生词本
- 浮动按钮界面，可拖动到任意位置
- 支持导入/导出生词本（支持多种格式）
- 自动记忆上下文，帮助理解单词
- 适用于普通网页和PDF文档

## 使用方法

1. 安装Tampermonkey浏览器扩展
2. 导入此脚本
3. 浏览网页时，选中单词后点击浮动按钮添加到生词本
4. 点击浮动按钮打开菜单，可以查看、导出或导入生词本

## 快捷键

- Alt+S: 添加选中的单词到生词本

## 技术说明

此脚本使用JavaScript编写，通过Tampermonkey在浏览器中运行。主要功能包括：

- 文本选择和上下文提取
- 本地存储管理
- 拖拽交互
- PDF文档支持
- 多格式导入导出
