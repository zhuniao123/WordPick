// ==UserScript==
// @name         生词本助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  将选中的单词加入生词本并存储到缓存中
// @author       Your Name
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
// @include      file:///*.pdf
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .vocab-helper-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 24px;
            cursor: move;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            user-select: none;
        }
        .vocab-helper-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }
        .vocab-helper-btn-inner {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .vocab-helper-menu {
            position: fixed;
            bottom: 80px;
            right: 20px;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            z-index: 9999;
            overflow: hidden;
            transition: all 0.3s ease;
            max-height: 0;
            opacity: 0;
            max-width: 180px;
            font-size: 14px;
        }
        .vocab-helper-menu.active {
            max-height: 200px;
            opacity: 1;
        }
        .vocab-helper-menu-item {
            padding: 6px 10px;
            cursor: pointer;
            transition: background-color 0.2s;
            white-space: nowrap;
            font-size: 13px;
        }
        .vocab-helper-menu-item:hover {
            background-color: #f1f1f1;
        }
        .vocab-helper-tooltip {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            transition: opacity 0.3s;
        }
        .vocab-helper-selection-menu {
            position: absolute;
            background-color: white;
            border-radius: 3px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            overflow: hidden;
        }
        .vocab-helper-selection-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        }
        .vocab-helper-selection-item:hover {
            background-color: #f1f1f1;
        }
    `);

    // 初始化生词缓存（使用 Tampermonkey 的存储 API 而不是 localStorage）
    const wordCacheKey = 'vocabularyCache';
    let wordCache = GM_getValue(wordCacheKey, []);

    // 创建一个添加单词到生词本的函数
    function addWordToVocabulary(word) {
        // 检查单词是否已存在
        const existingWords = wordCache.map(item => typeof item === 'object' ? item.word : item);
        if (word && !existingWords.includes(word)) {
            // 添加单词和时间戳
            wordCache.push({
                word: word,
                timestamp: new Date().toISOString(),
                context: getSelectionContext()
            });
            GM_setValue(wordCacheKey, wordCache);
            showTooltip(`"${word}" 已添加到生词本！`, 2000);
            return true;
        } else if (existingWords.includes(word)) {
            showTooltip(`"${word}" 已经在生词本中！`, 2000);
        }
        return false;
    }

    // 显示提示信息
    function showTooltip(message, duration = 2000) {
        // 使用通知
        GM_notification({
            title: '生词本助手',
            text: message,
            timeout: duration
        });
        
        // 同时显示页面内提示
        const tooltip = document.createElement('div');
        tooltip.className = 'vocab-helper-tooltip';
        tooltip.textContent = message;
        
        // 定位在鼠标位置或屏幕中央
        if (lastMousePosition.x && lastMousePosition.y) {
            tooltip.style.left = `${lastMousePosition.x + 10}px`;
            tooltip.style.top = `${lastMousePosition.y + 10}px`;
        } else {
            tooltip.style.left = '50%';
            tooltip.style.top = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
        }
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 300);
        }, duration);
    }

    // 获取选中文本的上下文
    function getSelectionContext() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            
            // 获取包含选中文本的段落或元素
            let contextNode = container;
            
            // 如果是文本节点，获取其父节点
            if (contextNode.nodeType === Node.TEXT_NODE) {
                contextNode = contextNode.parentNode;
            }
            
            // 尝试获取更大的上下文 (段落或其他块级元素)
            while (contextNode && 
                   contextNode.textContent && 
                   contextNode.textContent.length < 100 && 
                   contextNode.parentNode && 
                   contextNode.parentNode !== document.body) {
                contextNode = contextNode.parentNode;
            }
            
            // 获取上下文文本
            let contextText = '';
            
            // 如果上下文节点是菜单或我们自己的UI元素，尝试获取原始文档内容
            if (contextNode.classList && 
                (contextNode.classList.contains('vocab-helper-menu') || 
                 contextNode.classList.contains('vocab-helper-btn') ||
                 contextNode.classList.contains('vocab-helper-selection-menu'))) {
                
                // 回退到选中文本的原始范围
                const originalText = range.toString();
                
                // 尝试在页面中找到这个文本的其他实例
                const textNodes = [];
                const walker = document.createTreeWalker(
                    document.body, 
                    NodeFilter.SHOW_TEXT, 
                    { acceptNode: node => node.textContent.includes(originalText) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
                );
                
                let currentNode;
                while (currentNode = walker.nextNode()) {
                    if (currentNode !== container && !isDescendantOfHelper(currentNode)) {
                        textNodes.push(currentNode);
                    }
                }
                
                // 使用找到的第一个非助手元素的文本节点
                if (textNodes.length > 0) {
                    contextNode = textNodes[0].parentNode;
                    while (contextNode && 
                           contextNode.textContent && 
                           contextNode.textContent.length < 100 && 
                           contextNode.parentNode && 
                           contextNode.parentNode !== document.body) {
                        contextNode = contextNode.parentNode;
                    }
                }
            }
            
            // 检查是否是我们的助手元素
            function isDescendantOfHelper(node) {
                let parent = node.parentNode;
                while (parent) {
                    if (parent.classList && 
                        (parent.classList.contains('vocab-helper-menu') || 
                         parent.classList.contains('vocab-helper-btn') ||
                         parent.classList.contains('vocab-helper-selection-menu'))) {
                        return true;
                    }
                    parent = parent.parentNode;
                }
                return false;
            }
            
            // 获取最终的上下文文本
            contextText = contextNode.textContent.trim();
            
            // 如果上下文太长，截取选中词周围的文本
            if (contextText.length > 150) {
                const selectedText = selection.toString();
                const selectedIndex = contextText.indexOf(selectedText);
                
                if (selectedIndex !== -1) {
                    // 计算起始和结束位置，确保选中词在中间
                    const contextLength = 150;
                    const halfLength = Math.floor((contextLength - selectedText.length) / 2);
                    
                    let startPos = Math.max(0, selectedIndex - halfLength);
                    let endPos = Math.min(contextText.length, selectedIndex + selectedText.length + halfLength);
                    
                    // 调整以避免截断单词
                    while (startPos > 0 && contextText[startPos] !== ' ' && contextText[startPos] !== '.') {
                        startPos--;
                    }
                    
                    while (endPos < contextText.length && contextText[endPos] !== ' ' && contextText[endPos] !== '.') {
                        endPos++;
                    }
                    
                    contextText = (startPos > 0 ? '...' : '') + 
                                  contextText.substring(startPos, endPos).trim() + 
                                  (endPos < contextText.length ? '...' : '');
                } else {
                    // 如果找不到选中词，就简单截取前150个字符
                    contextText = contextText.substring(0, 150) + '...';
                }
            }
            
            return contextText;
        }
        return '';
    }

    // 跟踪鼠标位置
    const lastMousePosition = { x: 0, y: 0 };
    // 记住最后选择的文本
    let lastSelectedText = '';
    
    document.addEventListener('mousemove', function(e) {
        lastMousePosition.x = e.clientX;
        lastMousePosition.y = e.clientY;
    });
    
    // 保存选中的文本
    document.addEventListener('selectionchange', function() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText && selectedText.length > 0) {
            lastSelectedText = selectedText;
        }
    });

    // 注册 Tampermonkey 菜单命令
    GM_registerMenuCommand("添加选中的单词到生词本", function() {
        const selectedText = window.getSelection().toString().trim() || lastSelectedText;
        if (selectedText) {
            addWordToVocabulary(selectedText);
        } else {
            showTooltip('请先选中要添加的单词');
        }
    });

    GM_registerMenuCommand("导出生词本 (Markdown)", function() {
        exportVocabulary('markdown');
    });

    GM_registerMenuCommand("导出生词本 (CSV)", function() {
        exportVocabulary('csv');
    });

    GM_registerMenuCommand("导出生词本 (JSON)", function() {
        exportVocabulary('json');
    });

    GM_registerMenuCommand("导出生词本 (PDF)", function() {
        exportVocabulary('pdf');
    });

    GM_registerMenuCommand("查看生词本", function() {
        showVocabularyList();
    });

    GM_registerMenuCommand("从文件导入生词本", function() {
        importVocabularyFromFile();
    });

    // 创建浮动按钮
    function createFloatingButton() {
        // 先检查是否已存在按钮，避免重复创建
        if (document.querySelector('.vocab-helper-btn')) {
            return;
        }
        
        const button = document.createElement('div');
        button.className = 'vocab-helper-btn';
        button.innerHTML = '<div class="vocab-helper-btn-inner">📚</div>';
        button.title = '生词本助手';
        
        // 设置初始位置
        button.style.transition = 'none'; // 初始定位不需要过渡效果
        button.style.right = '20px';
        button.style.bottom = '20px';
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.className = 'vocab-helper-menu';
        
        const menuItems = [
            { text: '添加选中的单词', action: () => {
                const selectedText = window.getSelection().toString().trim() || lastSelectedText;
                if (selectedText) {
                    addWordToVocabulary(selectedText);
                } else {
                    showTooltip('请先选中要添加的单词');
                }
            }},
            { text: '查看生词本', action: () => showVocabularyList() },
            { text: '导出生词本', action: () => exportVocabulary('markdown') },
            { text: '导入生词本', action: () => importVocabularyFromFile() }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'vocab-helper-menu-item';
            menuItem.textContent = item.text;
            menuItem.addEventListener('click', () => {
                item.action();
                toggleMenu(false);
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        document.body.appendChild(button);
        
        // 添加点击其他地方关闭菜单的事件
        document.addEventListener('click', function(e) {
            // 如果点击的不是按钮或菜单内的元素，则关闭菜单
            if (!button.contains(e.target) && !menu.contains(e.target)) {
                toggleMenu(false);
            }
        });
        
        // 切换菜单显示
        function toggleMenu(show) {
            // 每次切换菜单时，更新菜单位置
            const buttonRect = button.getBoundingClientRect();
            const menuWidth = 180; // 与CSS中设置的max-width一致
            const menuHeight = 200; // 与CSS中设置的max-height一致
            
            // 检查右侧是否有足够空间
            if (buttonRect.right + menuWidth > window.innerWidth) {
                menu.style.right = 'auto';
                menu.style.left = Math.max(0, buttonRect.left - menuWidth) + 'px';
            } else {
                menu.style.left = 'auto';
                menu.style.right = (window.innerWidth - buttonRect.right) + 'px';
            }
            
            // 检查底部是否有足够空间
            if (buttonRect.top - menuHeight < 0) {
                menu.style.bottom = 'auto';
                menu.style.top = buttonRect.bottom + 'px';
            } else {
                menu.style.top = 'auto';
                menu.style.bottom = (window.innerHeight - buttonRect.top) + 'px';
            }
            
            // 显示或隐藏菜单
            if (show) {
                menu.classList.add('active');
            } else {
                menu.classList.remove('active');
            }
        }
        
        const buttonInner = button.querySelector('.vocab-helper-btn-inner');
        
        // 添加一个标志来跟踪是否正在拖动
        let isDragging = false;
        let dragDistance = 0;
        
        // 点击事件 - 只有在没有拖动时才显示菜单
        buttonInner.addEventListener('click', (e) => {
            e.stopPropagation();
            // 只有当没有拖动或拖动距离很小时才显示菜单
            if (!isDragging || dragDistance < 5) {
                toggleMenu(true); // 显示菜单
            }
            // 重置拖动状态
            isDragging = false;
            dragDistance = 0;
        });
        
        // 添加拖拽功能
        button.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左键点击
                e.preventDefault(); // 防止文本选择被清除
                
                // 重置拖动状态
                isDragging = false;
                dragDistance = 0;
                
                // 获取初始位置
                const rect = button.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                const startX = e.clientX;
                const startY = e.clientY;
                
                // 禁用过渡效果，使拖动更流畅
                button.style.transition = 'none';
                
                // 隐藏菜单
                toggleMenu(false);
                
                // 创建拖动函数
                const moveButton = (moveEvent) => {
                    moveEvent.preventDefault();
                    
                    // 标记为正在拖动
                    isDragging = true;
                    
                    // 计算新位置
                    const newLeft = moveEvent.clientX - offsetX;
                    const newTop = moveEvent.clientY - offsetY;
                    
                    // 确保按钮不会拖出视口
                    const maxX = window.innerWidth - rect.width;
                    const maxY = window.innerHeight - rect.height;
                    
                    const boundedLeft = Math.max(0, Math.min(newLeft, maxX));
                    const boundedTop = Math.max(0, Math.min(newTop, maxY));
                    
                    // 应用新位置
                    button.style.left = `${boundedLeft}px`;
                    button.style.top = `${boundedTop}px`;
                    button.style.right = 'auto';
                    button.style.bottom = 'auto';
                    
                    // 计算拖动距离
                    dragDistance = Math.sqrt(Math.pow(moveEvent.clientX - startX, 2) + Math.pow(moveEvent.clientY - startY, 2));
                    
                    // 保存按钮位置到存储中
                    const finalPosition = {
                        left: button.style.left,
                        top: button.style.top
                    };
                    GM_setValue('vocab-helper-position', finalPosition);
                };
                
                // 添加鼠标移动事件
                document.addEventListener('mousemove', moveButton);
                
                // 鼠标释放时移除事件监听
                document.addEventListener('mouseup', () => {
                    document.removeEventListener('mousemove', moveButton);
                    
                    // 恢复过渡效果
                    setTimeout(() => {
                        button.style.transition = 'all 0.3s ease';
                    }, 100);
                }, { once: true });
            }
        });
        
        // 从存储中恢复按钮位置
        const savedPosition = GM_getValue('vocab-helper-position', null);
        if (savedPosition) {
            button.style.left = savedPosition.left;
            button.style.top = savedPosition.top;
            button.style.right = 'auto';
            button.style.bottom = 'auto';
            
            // 更新菜单位置
            toggleMenu(false);
        }
        
        // 延迟恢复过渡效果
        setTimeout(() => {
            button.style.transition = 'all 0.3s ease';
        }, 500);
    }
    
    // 初始化函数，确保在PDF加载完成后运行
    function initialize() {
        // 检查是否已经初始化过
        if (document.querySelector('.vocab-helper-btn')) {
            console.log('生词本助手已经初始化，跳过重复初始化');
            return;
        }
        
        // 检查是否是PDF文件
        const isPDF = window.location.pathname.toLowerCase().endsWith('.pdf');
        
        // 移除任何可能存在的旧元素
        cleanup();
        
        // 创建浮动按钮
        createFloatingButton();
        
        // 如果是PDF，添加特殊处理
        if (isPDF) {
            handlePDFDocument();
        }
    }
    
    // 清理函数，移除所有相关元素
    function cleanup() {
        // 移除浮动按钮
        const existingButton = document.querySelector('.vocab-helper-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // 移除弹窗
        const existingPopup = document.querySelector('.vocab-helper-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // 移除拖动遮罩和占位符
        const dragOverlay = document.querySelector('[class*="vocab-drag-overlay"]');
        if (dragOverlay) {
            dragOverlay.remove();
        }
        
        const dragPlaceholder = document.querySelector('[class*="vocab-drag-placeholder"]');
        if (dragPlaceholder) {
            dragPlaceholder.remove();
        }
        
        // 移除提示框
        const tooltip = document.querySelector('.vocab-helper-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    // 处理PDF文档
    function handlePDFDocument() {
        console.log('PDF文档检测到，添加特殊处理...');
        
        // 等待PDF.js加载完成
        const checkPDFInterval = setInterval(() => {
            // 检查PDF.js的主要元素是否存在
            const pdfViewer = document.querySelector('#viewer') || 
                             document.querySelector('.pdfViewer') || 
                             document.querySelector('embed[type="application/pdf"]');
            
            if (pdfViewer) {
                clearInterval(checkPDFInterval);
                console.log('PDF查看器已加载，应用生词本助手...');
                
                // 为PDF查看器添加选择事件监听
                pdfViewer.addEventListener('mouseup', function(event) {
                    // 延迟一点以确保选择已完成
                    setTimeout(() => {
                        const selectedText = window.getSelection().toString().trim();
                        if (selectedText && selectedText.length > 0) {
                            // 如果按下了Alt键，直接添加单词
                            if (event.altKey) {
                                addWordToVocabulary(selectedText);
                            }
                        }
                    }, 100);
                });
                
                // 添加右键菜单支持
                pdfViewer.addEventListener('contextmenu', function(event) {
                    const selectedText = window.getSelection().toString().trim();
                    if (selectedText && selectedText.length > 0) {
                        setTimeout(() => {
                            createSelectionMenu(
                                event.clientX + window.scrollX, 
                                event.clientY + window.scrollY, 
                                selectedText
                            );
                        }, 10);
                    }
                });
                
                // 显示通知
                showTooltip('生词本助手已在PDF查看器中启用', 3000);
            }
        }, 1000);
        
        // 如果10秒后仍未找到PDF查看器，停止检查
        setTimeout(() => {
            clearInterval(checkPDFInterval);
            console.log('未能找到PDF查看器，可能是浏览器不支持或PDF尚未加载完成');
        }, 10000);
    }
    
    // 在页面加载完成后初始化
    if (document.readyState === 'complete') {
        initialize();
    } else {
        window.addEventListener('load', initialize);
    }
    
    // 为了确保在PDF加载后也能运行，添加一个延迟初始化
    setTimeout(initialize, 2000);

    // 导出生词本函数
    function exportVocabulary(format = 'markdown') {
        if (wordCache.length === 0) {
            GM_notification({
                title: '生词本助手',
                text: '生词本为空，没有可导出的内容',
                timeout: 2000
            });
            return;
        }

        let exportContent = '';
        let fileExtension = '';
        let mimeType = '';

        switch (format) {
            case 'markdown':
                exportContent = generateMarkdownExport();
                fileExtension = 'md';
                mimeType = 'text/markdown';
                break;
            case 'csv':
                exportContent = generateCSVExport();
                fileExtension = 'csv';
                mimeType = 'text/csv';
                break;
            case 'json':
                exportContent = generateJSONExport();
                fileExtension = 'json';
                mimeType = 'application/json';
                break;
            case 'pdf':
                exportContent = generatePDFExport();
                fileExtension = 'pdf';
                mimeType = 'application/pdf';
                break;
            default:
                exportContent = generateMarkdownExport();
                fileExtension = 'md';
                mimeType = 'text/markdown';
        }

        // 创建并下载文件
        const blob = new Blob([exportContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vocabulary.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        GM_notification({
            title: '生词本助手',
            text: `生词本已导出为 ${format.toUpperCase()} 格式`,
            timeout: 2000
        });
    }

    // 生成Markdown格式导出
    function generateMarkdownExport() {
        let exportContent = "# 生词本\n\n";
        exportContent += "| 单词 | 添加时间 | 上下文 |\n";
        exportContent += "|------|----------|--------|\n";
        
        wordCache.forEach(item => {
            const word = typeof item === 'object' ? item.word : item;
            const timestamp = typeof item === 'object' ? 
                            new Date(item.timestamp).toLocaleString() : '未知时间';
            const context = typeof item === 'object' ? (item.context || '').replace(/\|/g, '\\|') : '';
            
            exportContent += `| ${word} | ${timestamp} | ${context} |\n`;
        });

        return exportContent;
    }

    // 生成CSV格式导出
    function generateCSVExport() {
        let exportContent = "单词,添加时间,上下文\n";
        
        wordCache.forEach(item => {
            const word = typeof item === 'object' ? item.word : item;
            const timestamp = typeof item === 'object' ? 
                            new Date(item.timestamp).toLocaleString() : '未知时间';
            const context = typeof item === 'object' ? 
                            (item.context || '').replace(/,/g, '，').replace(/"/g, '""') : '';
            
            exportContent += `"${word}","${timestamp}","${context}"\n`;
        });

        return exportContent;
    }

    // 生成JSON格式导出
    function generateJSONExport() {
        return JSON.stringify(wordCache, null, 2);
    }

    // 生成PDF格式导出
    function generatePDFExport() {
        const pdfDoc = new jsPDF();
        pdfDoc.text('生词本', 10, 10);
        pdfDoc.text('单词\t添加时间\t上下文', 10, 20);
        
        let y = 30;
        wordCache.forEach(item => {
            const word = typeof item === 'object' ? item.word : item;
            const timestamp = typeof item === 'object' ? 
                            new Date(item.timestamp).toLocaleString() : '未知时间';
            const context = typeof item === 'object' ? (item.context || '') : '';
            
            pdfDoc.text(`${word}\t${timestamp}\t${context}`, 10, y);
            y += 10;
        });
        
        return pdfDoc.output();
    }

    // 显示生词列表的函数
    function showVocabularyList() {
        if (wordCache.length === 0) {
            showTooltip('生词本为空');
            return;
        }
        
        // 移除任何已存在的弹窗和相关元素
        const existingPopup = document.querySelector('.vocab-helper-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        const existingOverlay = document.querySelector('.vocab-drag-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const existingPlaceholder = document.querySelector('.vocab-drag-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
        
        // 创建弹窗容器
        const popup = document.createElement('div');
        popup.className = 'vocab-helper-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 15px;
            z-index: 10000;
            max-width: 800px;
            max-height: 70vh;
            width: 80%;
            overflow: auto;
            display: flex;
            flex-direction: column;
            font-family: Arial, sans-serif;
        `;
        
        // 添加标题
        const title = document.createElement('h2');
        title.textContent = '我的生词本';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 10px;
            color: #333;
            font-size: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 22px;
            cursor: pointer;
            color: #666;
            padding: 0;
            margin-left: 10px;
        `;
        closeButton.addEventListener('click', () => popup.remove());
        title.appendChild(closeButton);
        
        // 添加搜索框
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `
            margin-bottom: 10px;
            display: flex;
        `;
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '搜索单词...';
        searchInput.style.cssText = `
            flex-grow: 1;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
        `;
        searchContainer.appendChild(searchInput);
        
        // 添加操作按钮容器
        const actionContainer = document.createElement('div');
        actionContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        `;
        
        // 添加导出按钮
        const exportFormats = ['Markdown', 'CSV', 'JSON', 'PDF'];
        exportFormats.forEach(format => {
            const exportBtn = document.createElement('button');
            exportBtn.textContent = `导出 ${format}`;
            exportBtn.style.cssText = `
                padding: 4px 8px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            `;
            exportBtn.addEventListener('click', () => {
                exportVocabulary(format.toLowerCase());
                popup.remove();
            });
            actionContainer.appendChild(exportBtn);
        });
        
        // 添加导入按钮
        const importBtn = document.createElement('button');
        importBtn.textContent = '导入';
        importBtn.style.cssText = `
            padding: 4px 8px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        `;
        importBtn.addEventListener('click', () => {
            importVocabularyFromFile();
            popup.remove();
        });
        actionContainer.appendChild(importBtn);
        
        // 创建表格容器
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            overflow: auto;
            max-height: 50vh;
            border: 1px solid #eee;
            border-radius: 4px;
        `;
        
        // 创建表格
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        `;
        
        // 添加表头
        const thead = document.createElement('thead');
        thead.style.cssText = `
            background-color: #f5f5f5;
            position: sticky;
            top: 0;
        `;
        
        const headerRow = document.createElement('tr');
        ['单词', '添加时间', '上下文', '操作'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.cssText = `
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
                font-size: 13px;
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // 添加表格内容
        const tbody = document.createElement('tbody');
        
        // 处理单词数据
        wordCache.forEach((item, index) => {
            const word = typeof item === 'object' ? item.word : item;
            const timestamp = typeof item === 'object' && item.timestamp ? 
                            new Date(item.timestamp).toLocaleString() : '未知时间';
            const context = typeof item === 'object' && item.context ? item.context : '';
            
            const row = document.createElement('tr');
            row.dataset.word = word.toLowerCase();
            row.style.cssText = `
                border-bottom: 1px solid #eee;
            `;
            
            // 单词列
            const wordCell = document.createElement('td');
            wordCell.textContent = word;
            wordCell.style.cssText = `
                padding: 6px 8px;
                font-weight: bold;
            `;
            row.appendChild(wordCell);
            
            // 时间列
            const timeCell = document.createElement('td');
            timeCell.textContent = timestamp;
            timeCell.style.cssText = `
                padding: 6px 8px;
                color: #666;
                white-space: nowrap;
                font-size: 12px;
            `;
            row.appendChild(timeCell);
            
            // 上下文列
            const contextCell = document.createElement('td');
            contextCell.textContent = context;
            contextCell.style.cssText = `
                padding: 6px 8px;
                color: #555;
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 12px;
            `;
            // 添加悬停显示完整上下文
            if (context) {
                contextCell.title = context;
            }
            row.appendChild(contextCell);
            
            // 操作列
            const actionCell = document.createElement('td');
            actionCell.style.cssText = `
                padding: 6px 8px;
                white-space: nowrap;
            `;
            
            // 查询按钮
            const lookupBtn = document.createElement('button');
            lookupBtn.textContent = '查询';
            lookupBtn.style.cssText = `
                margin-right: 5px;
                padding: 3px 6px;
                background-color: #2196F3;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            `;
            lookupBtn.addEventListener('click', () => {
                GM_openInTab(`https://dict.youdao.com/search?q=${encodeURIComponent(word)}`, { active: true });
            });
            actionCell.appendChild(lookupBtn);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.style.cssText = `
                padding: 3px 6px;
                background-color: #f44336;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            `;
            deleteBtn.addEventListener('click', () => {
                // 从缓存中删除
                wordCache.splice(index, 1);
                GM_setValue(wordCacheKey, wordCache);
                row.remove();
                
                // 如果删除后列表为空，关闭弹窗
                if (wordCache.length === 0) {
                    popup.remove();
                    showTooltip('生词本已清空');
                } else {
                    showTooltip(`"${word}" 已从生词本中删除`);
                }
            });
            actionCell.appendChild(deleteBtn);
            
            row.appendChild(actionCell);
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        
        // 添加搜索功能
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const word = row.dataset.word;
                if (word.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
        
        // 组装弹窗
        popup.appendChild(title);
        popup.appendChild(searchContainer);
        popup.appendChild(actionContainer);
        popup.appendChild(tableContainer);
        
        // 创建拖动时的遮罩层
        const dragOverlay = document.createElement('div');
        dragOverlay.className = 'vocab-drag-overlay';
        dragOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            z-index: 9999;
            display: none;
            cursor: move;
        `;
        document.body.appendChild(dragOverlay);
        
        // 创建拖动时的克隆元素（轻量级占位符）
        const dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'vocab-drag-placeholder';
        dragPlaceholder.style.cssText = `
            position: fixed;
            background-color: rgba(200, 200, 200, 0.8);
            border: 2px dashed #666;
            border-radius: 8px;
            z-index: 10001;
            display: none;
            pointer-events: none;
        `;
        document.body.appendChild(dragPlaceholder);
        
        // 添加拖动功能
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        
        title.style.cursor = 'move';
        title.addEventListener('mousedown', (e) => {
            if (e.target === title) {
                isDragging = true;
                
                // 获取当前位置和尺寸
                const rect = popup.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                
                // 设置占位符尺寸和位置
                dragPlaceholder.style.width = rect.width + 'px';
                dragPlaceholder.style.height = rect.height + 'px';
                dragPlaceholder.style.left = rect.left + 'px';
                dragPlaceholder.style.top = rect.top + 'px';
                
                // 显示占位符和遮罩，隐藏实际弹窗
                dragPlaceholder.style.display = 'block';
                dragOverlay.style.display = 'block';
                popup.style.visibility = 'hidden';
                
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = e.clientX - dragOffsetX;
                const y = e.clientY - dragOffsetY;
                
                // 确保占位符不会超出视口
                const maxX = window.innerWidth - dragPlaceholder.offsetWidth;
                const maxY = window.innerHeight - dragPlaceholder.offsetHeight;
                
                const safeX = Math.max(0, Math.min(x, maxX));
                const safeY = Math.max(0, Math.min(y, maxY));
                
                dragPlaceholder.style.left = `${safeX}px`;
                dragPlaceholder.style.top = `${safeY}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                
                // 将实际弹窗移动到占位符位置
                const rect = dragPlaceholder.getBoundingClientRect();
                popup.style.left = `${rect.left}px`;
                popup.style.top = `${rect.top}px`;
                popup.style.transform = 'none';
                
                // 隐藏占位符和遮罩，显示实际弹窗
                dragPlaceholder.style.display = 'none';
                dragOverlay.style.display = 'none';
                popup.style.visibility = 'visible';
                
                // 检查是否需要调整位置以确保完全可见
                ensurePopupVisible(popup);
                
                // 延迟后重新检查位置，以处理可能的内容变化或滚动
                setTimeout(() => {
                    // 重新计算位置
                    const updatedRect = popup.getBoundingClientRect();
                    
                    // 如果弹窗尺寸发生变化，重新调整位置
                    if (updatedRect.width !== rect.width || updatedRect.height !== rect.height) {
                        ensurePopupVisible(popup);
                    }
                    
                    // 保存当前位置到本地存储，以便下次打开时恢复
                    try {
                        GM_setValue('vocabPopupPosition', {
                            left: popup.style.left,
                            top: popup.style.top
                        });
                    } catch (e) {
                        console.error('无法保存弹窗位置', e);
                    }
                }, 100);
            }
        });
        
        // 确保弹窗在视口内完全可见的函数
        function ensurePopupVisible(element) {
            const rect = element.getBoundingClientRect();
            let needsAdjustment = false;
            let newX = rect.left;
            let newY = rect.top;
            
            // 检查右边界
            if (rect.right > window.innerWidth) {
                newX = window.innerWidth - rect.width;
                needsAdjustment = true;
            }
            
            // 检查下边界
            if (rect.bottom > window.innerHeight) {
                newY = window.innerHeight - rect.height;
                needsAdjustment = true;
            }
            
            // 检查左边界
            if (rect.left < 0) {
                newX = 0;
                needsAdjustment = true;
            }
            
            // 检查上边界
            if (rect.top < 0) {
                newY = 0;
                needsAdjustment = true;
            }
            
            // 如果需要调整，使用平滑过渡
            if (needsAdjustment) {
                element.style.transition = 'left 0.3s, top 0.3s';
                element.style.left = `${newX}px`;
                element.style.top = `${newY}px`;
                
                // 过渡完成后移除过渡效果
                setTimeout(() => {
                    element.style.transition = 'none';
                }, 300);
            }
        }
        
        // 添加到文档
        document.body.appendChild(popup);
        
        // 尝试恢复上次保存的位置
        try {
            const savedPosition = GM_getValue('vocabPopupPosition', null);
            if (savedPosition) {
                popup.style.left = savedPosition.left;
                popup.style.top = savedPosition.top;
                popup.style.transform = 'none';
                
                // 确保恢复的位置在当前视口内
                setTimeout(() => ensurePopupVisible(popup), 0);
            } else {
                // 如果没有保存的位置，居中显示
                popup.style.top = '50%';
                popup.style.left = '50%';
                popup.style.transform = 'translate(-50%, -50%)';
            }
        } catch (e) {
            // 如果出错，使用默认居中位置
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
        }
        
        // 添加键盘快捷键
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                dragOverlay.remove();
                dragPlaceholder.remove();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }
    
    // 从文件导入生词本
    function importVocabularyFromFile() {
        // 创建一个隐藏的文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.csv,.md,.txt,.pdf';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // 监听文件选择事件
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) {
                document.body.removeChild(fileInput);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const fileContent = e.target.result;
                    const fileExtension = file.name.split('.').pop().toLowerCase();
                    
                    let importedWords = [];
                    
                    // 根据文件类型解析内容
                    if (fileExtension === 'json') {
                        importedWords = parseJSONImport(fileContent);
                    } else if (fileExtension === 'csv') {
                        importedWords = parseCSVImport(fileContent);
                    } else if (fileExtension === 'md' || fileExtension === 'txt') {
                        importedWords = parseTextImport(fileContent);
                    } else if (fileExtension === 'pdf') {
                        importedWords = parsePDFImport(fileContent);
                    }
                    
                    if (importedWords.length > 0) {
                        // 合并导入的单词与现有单词
                        const mergedWords = mergeVocabularyLists(wordCache, importedWords);
                        wordCache = mergedWords;
                        GM_setValue(wordCacheKey, wordCache);
                        
                        GM_notification({
                            title: '生词本助手',
                            text: `成功导入 ${importedWords.length} 个单词`,
                            timeout: 2000
                        });
                    } else {
                        GM_notification({
                            title: '生词本助手',
                            text: '没有找到可导入的单词',
                            timeout: 2000
                        });
                    }
                } catch (error) {
                    console.error('导入生词本出错:', error);
                    GM_notification({
                        title: '生词本助手',
                        text: '导入失败: ' + error.message,
                        timeout: 3000
                    });
                }
                
                document.body.removeChild(fileInput);
            };
            
            reader.onerror = function() {
                GM_notification({
                    title: '生词本助手',
                    text: '读取文件失败',
                    timeout: 2000
                });
                document.body.removeChild(fileInput);
            };
            
            reader.readAsText(file);
        });
        
        // 触发文件选择对话框
        fileInput.click();
    }
    
    // 解析JSON导入
    function parseJSONImport(content) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.map(item => {
                    // 如果是简单字符串，转换为对象格式
                    if (typeof item === 'string') {
                        return {
                            word: item,
                            timestamp: new Date().toISOString(),
                            context: ''
                        };
                    }
                    return item;
                });
            }
            return [];
        } catch (e) {
            console.error('JSON解析错误:', e);
            return [];
        }
    }
    
    // 解析CSV导入
    function parseCSVImport(content) {
        const lines = content.split('\n');
        const result = [];
        
        // 跳过标题行
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // 简单的CSV解析，处理引号内的逗号
            const values = [];
            let currentValue = '';
            let inQuotes = false;
            
            for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            
            if (currentValue) {
                values.push(currentValue);
            }
            
            // 至少需要单词
            if (values.length > 0 && values[0]) {
                result.push({
                    word: values[0].replace(/^"(.*)"$/, '$1'),
                    timestamp: values.length > 1 ? new Date(values[1].replace(/^"(.*)"$/, '$1')).toISOString() : new Date().toISOString(),
                    context: values.length > 2 ? values[2].replace(/^"(.*)"$/, '$1') : ''
                });
            }
        }
        
        return result;
    }
    
    // 解析文本导入 (简单的一行一个单词)
    function parseTextImport(content) {
        const lines = content.split('\n');
        const result = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // 尝试从Markdown表格中提取
            const mdMatch = line.match(/\|\s*([^|]+)\s*\|/);
            if (mdMatch && mdMatch[1]) {
                result.push({
                    word: mdMatch[1].trim(),
                    timestamp: new Date().toISOString(),
                    context: ''
                });
                continue;
            }
            
            // 否则将整行作为单词
            if (line.length > 0 && !line.startsWith('#') && !line.startsWith('|')) {
                result.push({
                    word: line,
                    timestamp: new Date().toISOString(),
                    context: ''
                });
            }
        }
        
        return result;
    }
    
    // 解析PDF导入
    function parsePDFImport(content) {
        // PDF解析暂未实现
        return [];
    }
    
    // 合并词汇列表，避免重复
    function mergeVocabularyLists(existingList, newList) {
        const existingWords = new Set(existingList.map(item => 
            typeof item === 'object' ? item.word : item
        ));
        
        const uniqueNewItems = newList.filter(item => {
            const word = typeof item === 'object' ? item.word : item;
            return !existingWords.has(word);
        });
        
        return [...existingList, ...uniqueNewItems];
    }

    // 添加快捷键支持
    document.addEventListener('keydown', function(event) {
        // Alt+S 添加选中的单词
        if (event.altKey && event.key === 's') {
            const selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                addWordToVocabulary(selectedText);
                event.preventDefault();
            }
        }
        
        // Alt+V 查看生词本
        if (event.altKey && event.key === 'v') {
            showVocabularyList();
            event.preventDefault();
        }
    });
})();
