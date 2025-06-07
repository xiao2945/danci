// 简单测试双引号字符串功能

// 模拟parseRulePattern方法
function parseRulePattern(pattern) {
    const result = [];
    let i = 0;
    
    while (i < pattern.length) {
        const char = pattern[i];
        
        if (char === '"') {
            // 处理双引号字符串
            i++; // 跳过开始的双引号
            let literalValue = '';
            while (i < pattern.length && pattern[i] !== '"') {
                literalValue += pattern[i];
                i++;
            }
            if (i < pattern.length) {
                i++; // 跳过结束的双引号
            }
            result.push({ type: 'literal', value: literalValue });
        } else if (char === '\\') {
            // 处理位置标记
            i++;
            if (i < pattern.length) {
                const marker = pattern[i];
                result.push({ type: 'position', value: marker });
                i++;
            }
        } else {
            // 其他字符作为集合引用
            result.push({ type: 'set', value: char });
            i++;
        }
    }
    
    return result;
}

// 模拟matchesPatternAtPosition方法
function matchesPatternAtPosition(word, pattern, startIndex) {
    let wordIndex = startIndex;
    
    for (const element of pattern) {
        if (element.type === 'literal') {
            // 检查是否有足够的字符来匹配字面量
            if (wordIndex + element.value.length > word.length) {
                return false;
            }
            
            // 检查子字符串是否匹配
            const substring = word.substring(wordIndex, wordIndex + element.value.length);
            if (substring !== element.value) {
                return false;
            }
            
            wordIndex += element.value.length;
        } else if (element.type === 'position') {
            // 位置标记处理（简化）
            if (element.value === 'b' && wordIndex !== 0) {
                return false;
            }
            if (element.value === 'e' && wordIndex !== word.length) {
                return false;
            }
        } else {
            // 集合匹配（简化，这里只是跳过）
            if (wordIndex >= word.length) {
                return false;
            }
            wordIndex++;
        }
    }
    
    return true;
}

// 测试函数
function runTests() {
    console.log('开始测试双引号字符串匹配功能...');
    
    // 测试1: 单字符匹配
    console.log('\n测试1: 单字符匹配');
    const pattern1 = parseRulePattern('"t"');
    console.log('模式:', pattern1);
    console.log('"t" 匹配 "test":', matchesPatternAtPosition('test', pattern1, 0));
    console.log('"t" 匹配 "hello":', matchesPatternAtPosition('hello', pattern1, 0));
    
    // 测试2: 多字符字符串匹配
    console.log('\n测试2: 多字符字符串匹配');
    const pattern2 = parseRulePattern('"tion"');
    console.log('模式:', pattern2);
    console.log('"tion" 匹配 "action":', matchesPatternAtPosition('action', pattern2, 2));
    console.log('"tion" 匹配 "test":', matchesPatternAtPosition('test', pattern2, 0));
    
    // 测试3: 前缀匹配
    console.log('\n测试3: 前缀匹配');
    const pattern3 = parseRulePattern('\\b"pre"');
    console.log('模式:', pattern3);
    console.log('\\b"pre" 匹配 "prefix":', matchesPatternAtPosition('prefix', pattern3, 0));
    
    // 测试4: 后缀匹配
    console.log('\n测试4: 后缀匹配');
    const pattern4 = parseRulePattern('"tion"\\e');
    console.log('模式:', pattern4);
    console.log('"tion"\\e 匹配 "action":', matchesPatternAtPosition('action', pattern4, 2));
    
    // 测试5: 连续字面量
    console.log('\n测试5: 连续字面量');
    const pattern5 = parseRulePattern('"t""i""o""n"');
    console.log('模式:', pattern5);
    console.log('"t""i""o""n" 匹配 "action":', matchesPatternAtPosition('action', pattern5, 2));
    
    console.log('\n测试完成!');
}

// 运行测试
runTests();