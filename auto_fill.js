// ==UserScript==
// @name         妙手SKU自动化录入
// @description  从本地选择文件并自动填入SKU
// ==/UserScript==

(function() {
    // 创建一个悬浮的操作面板
    const panel = document.createElement('div');
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
    
    panel.innerHTML = `
        <h3 style="margin-top: 0; font-size: 16px;">🤖 SKU 自动录入助手</h3>
        <p style="font-size: 12px; color: #666;">请选择包含SKU的文本文件 (每行一个SKU)</p>
        <input type="file" id="sku-file-input" accept=".txt,.csv" style="margin-bottom: 10px; width: 100%;" />
        <div id="sku-status" style="font-size: 13px; margin-bottom: 10px; color: blue;">等待选择文件...</div>
        <button id="sku-fill-btn" disabled style="padding: 6px 12px; background: #409EFF; color: #fff; border: none; border-radius: 4px; cursor: pointer; width: 100%;">填充可视区域的 SKU</button>
        <p style="font-size: 12px; color: #999; margin-bottom: 0; margin-top: 10px;">提示: 如果表格行很多，请滚动表格后再次点击填充。</p>
    `;
    
    document.body.appendChild(panel);
    
    let skuList = [];
    let currentIndex = 0;

    // 监听文件选择
    document.getElementById('sku-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            // 按行分割，并去除空白字符
            skuList = content.split('\n').map(s => s.trim()).filter(s => s !== '');
            currentIndex = 0;
            document.getElementById('sku-status').innerText = `加载成功！共 ${skuList.length} 个 SKU。`;
            document.getElementById('sku-fill-btn').disabled = false;
        };
        reader.readAsText(file);
    });

    // 监听填充按钮点击
    document.getElementById('sku-fill-btn').addEventListener('click', function() {
        if (currentIndex >= skuList.length) {
            alert('所有 SKU 已经分配完毕！');
            return;
        }

        // 查找页面上所有的 SKU 输入框
        const inputs = document.querySelectorAll('input[placeholder="提供平台SKU"]');
        let filledCount = 0;

        inputs.forEach(input => {
            // 如果这个输入框已经有值，跳过（或者覆盖？这里选择如果为空才填入）
            if (input.value === '' && currentIndex < skuList.length) {
                const sku = skuList[currentIndex];
                
                // 赋值并触发 Vue/React 的双向绑定更新
                input.value = sku;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                currentIndex++;
                filledCount++;
            }
        });

        document.getElementById('sku-status').innerText = `已填入 ${currentIndex} / ${skuList.length} 个 SKU。`;
        
        if (filledCount === 0) {
            alert('当前页面没有找到空的 SKU 输入框，请往下滚动表格后再点击填充！');
        } else {
            console.log(`本次成功填入 ${filledCount} 个 SKU`);
        }
    });

})();
