// ==UserScript==
// @name         妙手SKU自动化录入(智能升级版)
// @description  自动解析维度并填充
// ==/UserScript==

(function() {
    // 清除旧面板
    const oldPanel = document.getElementById('miaoshou-sku-panel');
    if (oldPanel) oldPanel.remove();

    // 注入面板
    const panel = document.createElement('div');
    panel.id = 'miaoshou-sku-panel';
    panel.style.position = 'fixed';
    panel.style.top = '20px';
    panel.style.right = '20px';
    panel.style.zIndex = '999999';
    panel.style.backgroundColor = '#fff';
    panel.style.border = '1px solid #ccc';
    panel.style.padding = '15px';
    panel.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    panel.style.borderRadius = '8px';
    panel.style.fontFamily = 'sans-serif';
    panel.style.width = '320px';
    
    panel.innerHTML = `
        <div id="miaoshou-close-btn" style="position: absolute; top: 10px; right: 15px; cursor: pointer; font-size: 16px; color: #999; font-weight: bold;">✕</div>
        <h3 style="margin-top: 0; font-size: 16px;">🤖 SKU 智能录入引擎</h3>
        <p style="font-size: 12px; color: #666;">格式: 颜色-尺寸-编码-价格-库存-状况-平台sku-促销价-促销时间-[图片名]</p>
        
        <div style="font-size: 12px; margin-bottom: 5px; font-weight: bold;">选择数据文件 (.txt)</div>
        <input type="file" id="sku-file-input" accept=".txt,.csv" style="margin-bottom: 10px; width: 100%;" />
        <div id="sku-status" style="font-size: 12px; margin-bottom: 10px; color: #333; background: #f5f5f5; padding: 5px; border-radius: 4px;">等待选择文件...</div>
        <button id="btn-start-auto" disabled style="padding: 10px 12px; background: #67C23A; color: #fff; border: none; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold; font-size: 14px;">▶ 一键全自动执行 (变体 + 填充)</button>
    `;
    
    document.body.appendChild(panel);

    // 监听关闭按钮
    panel.querySelector('#miaoshou-close-btn').addEventListener('click', function() {
        panel.remove();
    });
    
    let parsedData = [];
    let uniqueColors = [];
    let uniqueSizes = [];
    
    // 全局图片文件存储
    let selectedImageFiles = {};
    


    // 拦截全局的文件上传框，实现无头注入
    let targetFileForUpload = null;
    const originalClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function() {
        if (this.type === 'file' && targetFileForUpload) {
            try {
                const dt = new DataTransfer();
                dt.items.add(targetFileForUpload);
                this.files = dt.files;
                targetFileForUpload = null;
                this.dispatchEvent(new Event('change', { bubbles: true }));
                return; // 阻止弹出系统文件选择框
            } catch (err) {
                console.error("图片注入失败", err);
            }
        }
        originalClick.apply(this, arguments);
    };
    


    // 辅助函数：模拟 Vue 输入
    function setNativeValue(element, value) {
        if (!element) return;
        
        let valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
        let prototype = Object.getPrototypeOf(element);
        let prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        
        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
            valueSetter.call(element, value);
        } else {
            element.value = value; // Fallback
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 监听文件选择
    panel.querySelector('#sku-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const lines = content.split('\n').map(s => s.trim()).filter(s => s !== '');
            parsedData = [];
            let colorsSet = new Set();
            let sizesSet = new Set();

            lines.forEach(line => {
                let cleanLine = line.trim();
                if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
                    cleanLine = cleanLine.substring(1, cleanLine.length - 1);
                }
                
                const parts = cleanLine.split('"-"');
                if(parts.length >= 9) {
                    let color = parts[0];
                    let size = parts[1];
                    parsedData.push({
                        color: color,
                        size: size,
                        code: parts[2],
                        price: parts[3],
                        stock: parts[4],
                        condition: parts[5],
                        platformSku: parts[6],
                        promoPrice: parts[7],
                        promoTime: parts[8] || '', 
                        imageName: parts[9] || '' // 第10列为图片名
                    });
                    colorsSet.add(color);
                    sizesSet.add(size);
                }
            });

            uniqueColors = Array.from(colorsSet);
            uniqueSizes = Array.from(sizesSet);

            document.getElementById('sku-status').innerHTML = 
                `解析成功! 共 <b>${parsedData.length}</b> 行数据。<br>` +
                `🎨 颜色 (${uniqueColors.length}): ${uniqueColors.join(', ')}<br>` +
                `📏 尺寸 (${uniqueSizes.length}): ${uniqueSizes.join(', ')}`;
                
            document.getElementById('btn-start-auto').disabled = false;
        };
        reader.readAsText(file);
    });

    // 监听自动添加变体维度

    panel.querySelector('#btn-start-auto').addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = "正在自动处理中，请不要乱动...";
        
        try {
            document.getElementById('sku-status').innerHTML = '步骤 1/3: 正在清除并添加【变体维度】...';
            
            const formItems = Array.from(document.querySelectorAll('.sale-attribute-list .jx-form-item'));
            const colorItem = formItems.find(item => {
                const label = item.querySelector('.jx-form-item__label');
                return label && label.textContent.includes('颜色');
            });
            const sizeItem = formItems.find(item => {
                const label = item.querySelector('.jx-form-item__label');
                return label && (label.textContent.includes('尺寸') || label.textContent.includes('尺码'));
            });
            
            async function fillAttribute(item, values) {
                if (!item || !values || values.length === 0) return;
                
                // 清除现有
                let deleteBtns = Array.from(item.querySelectorAll('.delete-icon'));
                for (let db of deleteBtns) {
                    db.click();
                    await new Promise(r => setTimeout(r, 100));
                }
                
                // 逐个添加
                const addBtn = Array.from(item.querySelectorAll('button')).find(b => b.textContent.includes('添加选项'));
                
                for (let i = 0; i < values.length; i++) {
                    let inputs = Array.from(item.querySelectorAll('input[type="text"]'));
                    
                    // 【关键修复】如果当前需要的输入框索引超出了页面现有的输入框数量，直接点击添加选项
                    if (i >= inputs.length && addBtn) {
                        addBtn.click();
                        await new Promise(r => setTimeout(r, 200));
                        inputs = Array.from(item.querySelectorAll('input[type="text"]'));
                    }
                    
                    const inputToFill = inputs[i];
                    if (inputToFill) {
                        inputToFill.focus();
                        
                        const selectWrapper = inputToFill.closest('.jx-select, .el-select');
                        if (selectWrapper) {
                            selectWrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                            selectWrapper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                            selectWrapper.click();
                        }
                        
                        setNativeValue(inputToFill, values[i]);
                        inputToFill.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        await new Promise(r => setTimeout(r, 300));
                        
                        let clickedDropdown = false;
                        if (selectWrapper) {
                            const allItems = Array.from(document.querySelectorAll('.jx-select-dropdown__item, .el-select-dropdown__item, .jx-dropdown-menu__item, .el-select-dropdown li, .jx-select-dropdown li'));
                            const visibleItems = allItems.filter(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            });
                            const exactItem = visibleItems.find(el => el.textContent.trim() === values[i]);
                            if (exactItem) {
                                exactItem.click();
                                clickedDropdown = true;
                            }
                        }
                        
                        if (!clickedDropdown) {
                            inputToFill.dispatchEvent(new Event('change', { bubbles: true }));
                            const enterParams = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
                            inputToFill.dispatchEvent(new KeyboardEvent('keydown', enterParams));
                            inputToFill.dispatchEvent(new KeyboardEvent('keypress', enterParams));
                            inputToFill.dispatchEvent(new KeyboardEvent('keyup', enterParams));
                            inputToFill.blur();
                        }
                        
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
            }

            if (colorItem) await fillAttribute(colorItem, uniqueColors);
            if (sizeItem) await fillAttribute(sizeItem, uniqueSizes);
            
            document.getElementById('sku-status').innerHTML = '步骤 2/3: 尝试确认提示框并等待表格生成...';
            
            // 循环等待（最长30秒），并尝试自动点击弹出框的“确认”按钮
            for (let i = 0; i < 60; i++) {
                // 尝试找寻网页中可能存在的确认按钮（比如 el-message-box__btns 的主按钮，或是带有“确 定”、“保存”字样的按钮）
                const confirmBtns = Array.from(document.querySelectorAll('.el-message-box__btns button.el-button--primary, .jx-dialog__footer button.jx-button--primary, .el-dialog__footer button.el-button--primary'));
                for (let cBtn of confirmBtns) {
                    if (cBtn.offsetParent !== null) { // 元素可见
                        cBtn.click();
                        console.log("自动点击了确认弹窗");
                    }
                }
                
                // 等待表格出现，且行数大于0
                const curRows = document.querySelectorAll('.pro-virtual-table__row');
                if (curRows.length > 0) {
                    // 多等1秒，确保 Vue 完全渲染完成并且图片上传按钮挂载好了
                    await new Promise(r => setTimeout(r, 1000));
                    break;
                }
                await new Promise(r => setTimeout(r, 500));
            }
            
            document.getElementById('sku-status').innerHTML = '步骤 3/3: 正在自动填充表格与上传图片...';
            await startFillingLogic();
            
            document.getElementById('sku-status').innerHTML = '✅ 全自动提效完成！';
            
        } catch (err) {
            console.error(err);
            alert("发生异常，请检查控制台。");
        } finally {
            btn.disabled = false;
            btn.textContent = "▶ 一键全自动执行 (变体 + 填充)";
        }
    });

    // 辅助：按 placeholder 查找 input

    function fillInputByPlaceholder(row, placeholderSnippet, value) {
        if (!value) return;
        const input = Array.from(row.querySelectorAll('input')).find(i => i.placeholder && i.placeholder.includes(placeholderSnippet));
        if (input) setNativeValue(input, value);
    }

    // 监听填充表格
    async function startFillingLogic() {
        const rows = Array.from(document.querySelectorAll('.pro-virtual-table__row'));
        let filledCount = 0;
        
        // 禁用按钮防连点
        this.disabled = true;
        //

        let totalFilled = 0;
        let lastScrollTop = -1;
        let stuckCount = 0;
        
        // 记录哪些数据已经填过了
        let processedMatches = new Set();

        while (true) {
            let processedInThisBatch = true;
            let currentBatchFilled = 0;

            // 循环处理，每次填完一行立刻中断并重新获取最新 DOM
            while (processedInThisBatch) {
                processedInThisBatch = false;
                const rows = Array.from(document.querySelectorAll('.pro-virtual-table__row'));
                
                for (let row of rows) {
                    const rowText = row.innerText;
                    
                    const possibleMatches = parsedData.filter(d => rowText.includes(d.color) && rowText.includes(d.size));
                    possibleMatches.sort((a, b) => b.size.length - a.size.length);
                    const match = possibleMatches[0];
                    
                    if (!match || processedMatches.has(match)) continue;
                    
                    // 开始精确填入
                    fillInputByPlaceholder(row, '外部产品 ID', match.code);
                    fillInputByPlaceholder(row, '商品基本价格', match.price);
                    fillInputByPlaceholder(row, '商品数量', match.stock);
                    fillInputByPlaceholder(row, '提供平台SKU', match.platformSku);
                    fillInputByPlaceholder(row, '待售产品的价格', match.promoPrice);
                    
                    if (match.promoTime.includes('至')) {
                        const dates = match.promoTime.split('至');
                        fillInputByPlaceholder(row, '促销开始', dates[0].trim());
                        fillInputByPlaceholder(row, '促销结束', dates[1].trim());
                    }
                    
                    let conditionInput = null;
                    const selects = Array.from(row.querySelectorAll('.jx-select, .el-select'));
                    
                    for (let sel of selects) {
                        const text = sel.textContent || '';
                        if (text.includes('新') || text.includes('New') || text.includes('二手') || text.includes(match.condition)) {
                            conditionInput = sel.querySelector('input');
                            break;
                        }
                    }
                    
                    if (!conditionInput && selects.length > 0) {
                        const possibleSelects = selects.filter(sel => {
                            const text = sel.textContent || '';
                            return !text.includes('UPC') && !text.includes('EAN') && !text.includes('ASIN') && !text.includes('GTIN');
                        });
                        if (possibleSelects.length > 0) {
                            conditionInput = possibleSelects[possibleSelects.length - 1].querySelector('input');
                        } else {
                            conditionInput = selects[selects.length - 1].querySelector('input');
                        }
                    }
                    
                    if (conditionInput && match.condition) {
                        const selectContainer = conditionInput.closest('.jx-select, .el-select, .jx-input');
                        const targetToClick = selectContainer || conditionInput;
                        
                        targetToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                        targetToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                        targetToClick.click();
                        
                        conditionInput.focus();
                        setNativeValue(conditionInput, match.condition);
                        
                        await new Promise(r => setTimeout(r, 500));
                        
                        const allItems = Array.from(document.querySelectorAll('.jx-select-dropdown__item, .el-select-dropdown__item, .jx-dropdown-menu__item, .el-select-dropdown li, .jx-select-dropdown li'));
                        const visibleItems = allItems.filter(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                        });
                        
                        const exactItem = visibleItems.find(el => el.textContent.trim() === match.condition);
                        
                        if (exactItem) {
                            exactItem.click(); 
                        } else {
                            const enterParams = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                            conditionInput.dispatchEvent(new KeyboardEvent('keydown', enterParams));
                            conditionInput.blur();
                        }
                    }
                    
                    // ================= 新增：自动上传图片 =================
                    // 但我们需要找的是 picture-table-list 里面的对应图片的上传按钮
                    // 因为妙手里面图片通常在单独的图片区域 (picture-table-list)
                    if (match.imageName) {
                        try {
                            // 绕过浏览器限制，从我们本地开的后门服务中直接获取绝对路径的图片内容！
                            const imgUrl = 'http://localhost:31415/?path=' + encodeURIComponent(match.imageName);
                            const res = await fetch(imgUrl);
                            if (res.ok) {
                                const blob = await res.blob();
                                const filename = match.imageName.split('/').pop() || 'image.jpg';
                                const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                                
                                const picRows = Array.from(document.querySelectorAll('.picture-table-item, .product-picture-item'));
                                const uploadBtn = row.querySelector('.shopee-icon-shangchuantupian') || row.querySelector('i[class*="shangchuantupian"]');
                                
                                if (uploadBtn) {
                                    targetFileForUpload = file;
                                    uploadBtn.click();
                                    await new Promise(r => setTimeout(r, 800));
                                } else {
                                    for (let pRow of picRows) {
                                        if (pRow.textContent.includes(match.color)) {
                                            const pBtn = pRow.querySelector('.shopee-icon-shangchuantupian');
                                            if (pBtn) {
                                                targetFileForUpload = file;
                                                pBtn.click();
                                                await new Promise(r => setTimeout(r, 800));
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("加载绝对路径图片失败", err);
                        }
                    }
                    // ====================================================

                    currentBatchFilled++;
                    await new Promise(r => setTimeout(r, 100));
                    
                    processedMatches.add(match);
                    
                    // 打断 for 循环，重新 querySelectorAll，避免 Vue 重绘导致的旧 DOM 失效
                    processedInThisBatch = true;
                    break;
                }
            }

            totalFilled += currentBatchFilled;

            // 尝试寻找滚动容器
            let scrollContainer = null;
            if (rows.length > 0) {
                let el = rows[0].parentElement;
                while (el && el !== document.body) {
                    if (el.classList.contains('jx-scrollbar__wrap') || el.classList.contains('pro-virtual-table__body-wrapper')) {
                        scrollContainer = el;
                        break;
                    }
                    const style = window.getComputedStyle(el);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                        scrollContainer = el;
                        break;
                    }
                    el = el.parentElement;
                }
            }

            if (scrollContainer) {
                // 如果滚动条位置没有改变，说明到底了
                if (Math.abs(scrollContainer.scrollTop - lastScrollTop) <= 2) {
                    stuckCount++;
                    if (stuckCount >= 2) break; // 连续两次没滚下去就结束
                } else {
                    stuckCount = 0;
                }
                lastScrollTop = scrollContainer.scrollTop;
                
                // 向下滚动一个屏幕的高度
                scrollContainer.scrollTop += scrollContainer.clientHeight - 100; // 留一点重叠余量
                
                // 重点：等待网页渲染新的虚拟表格行
                await new Promise(r => setTimeout(r, 1000));
            } else {
                // 如果实在找不到滚动容器，就只执行当前能看到的行
                break;
            }
        }

        //
        //
        alert(`✅ 自动翻页扫描完毕！共成功匹配并填入了 ${totalFilled} 行数据！`);
    }

})();
