// 测试双引号字符串匹配功能

// 模拟浏览器环境
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

// 简化的测试，直接测试相关方法
const fs = require('fs');
const path = require('path');

// 读取ruleEngine.js文件内容
const ruleEngineCode = fs.readFileSync(path.join(__dirname, 'js', 'ruleEngine.js'), 'utf8');

// 创建一个简化的测试环境
class MockFileStorageManager {
    constructor() {}
    loadSets() { return new Map(); }
    saveSets() {}
}

// 在全局作用域中定义FileStorageManager
global.FileStorageManager = MockFileStorageManager;

// 执行ruleEngine.js代码
eval(ruleEngineCode);

// 将RuleEngine设为全局变量
global.RuleEngine = RuleEngine;

function testLiteralStrings() {
    const engine = new RuleEngine();
    
    console.log('=== 测试双引号字符串匹配功能 ===\n');
    
    // 测试用例
    const testCases = [
        {
            name: '单字符匹配（向后兼容）',
            rule: '#测试单字符\n:"a"',
            words: ['apple', 'banana', 'cat'],
            expected: ['apple']
        },
        {
            name: '多字符字符串匹配',
            rule: '#测试字符串\n:"ing"',
            words: ['running', 'walking', 'cat', 'singing'],
            expected: ['running', 'walking', 'singing']
        },
        {
            name: '前缀匹配',
            rule: '#测试前缀\n:\\b"pre"',
            words: ['prefix', 'prepare', 'cat', 'prelude'],
            expected: ['prefix', 'prepare', 'prelude']
        },
        {
            name: '后缀匹配',
            rule: '#测试后缀\n:"tion"\\e',
            words: ['action', 'creation', 'cat', 'nation'],
            expected: ['action', 'creation', 'nation']
        },
        {
            name: '组合匹配',
            rule: '#测试组合\n:"t""i""o""n"',
            words: ['action', 'creation', 'cat', 'nation'],
            expected: ['action', 'creation', 'nation']
        },
        {
            name: '字符串与集合组合',
            rule: '#测试组合\nV=={a,e,i,o,u}\n:V"ng"',
            words: ['running', 'walking', 'singing', 'cat'],
            expected: ['running', 'singing']
        }
    ];
    
    let passCount = 0;
    let totalCount = testCases.length;
    
    for (const testCase of testCases) {
        try {
            console.log(`测试: ${testCase.name}`);
            console.log(`规则: ${testCase.rule.replace(/\n/g, ' | ')}`);
            console.log(`输入单词: [${testCase.words.join(', ')}]`);
            
            const parseResult = engine.parseRule(testCase.rule);
            if (!parseResult.success) {
                throw new Error(`规则解析失败: ${parseResult.error}`);
            }
            
            const result = engine.applyRule(testCase.words, parseResult.rule.name);
            const resultWords = result.map(word => typeof word === 'string' ? word : word.word || word);
            
            console.log(`实际结果: [${resultWords.join(', ')}]`);
            console.log(`期望结果: [${testCase.expected.join(', ')}]`);
            
            // 检查结果
            const isMatch = JSON.stringify(resultWords.sort()) === JSON.stringify(testCase.expected.sort());
            
            if (isMatch) {
                console.log('✅ 测试通过\n');
                passCount++;
            } else {
                console.log('❌ 测试失败\n');
            }
            
        } catch (error) {
            console.log(`❌ 测试出错: ${error.message}\n`);
        }
    }
    
    console.log(`=== 测试完成: ${passCount}/${totalCount} 通过 ===`);
    
    if (passCount === totalCount) {
        console.log('🎉 所有测试都通过了！双引号字符串匹配功能工作正常。');
    } else {
        console.log('⚠️ 部分测试失败，需要进一步检查。');
    }
}

// 运行测试
testLiteralStrings();