// 简单测试新功能

// 模拟FileStorageManager
class MockFileStorageManager {
    constructor() { }
    loadRules() { return []; }
    saveRules() { }
    deleteRule() { }
}

// 模拟localStorage
const mockLocalStorage = {
    getItem: (key) => null,
    setItem: (key, value) => { },
    removeItem: (key) => { },
    clear: () => { }
};

// 设置全局变量
global.FileStorageManager = MockFileStorageManager;
global.localStorage = mockLocalStorage;

// 加载RuleEngine
const RuleEngine = require('./js/ruleEngine.js');

// 测试新功能
function testNewFeatures() {
    console.log('=== 测试新的排序规则功能 ===\n');

    const engine = new RuleEngine();

    // 测试1: @@模式解析
    console.log('测试1: @@模式解析');
    try {
        const result1 = engine.parseSortRule('@@CV');
        console.log('@@CV 解析结果:', JSON.stringify(result1, null, 2));
        console.log('✓ @@模式解析成功\n');
    } catch (error) {
        console.log('✗ @@模式解析失败:', error.message, '\n');
    }

    // 测试2: 普通@模式解析
    console.log('测试2: 普通@模式解析');
    try {
        const result2 = engine.parseSortRule('C^V*');
        console.log('C^V* 解析结果:', JSON.stringify(result2, null, 2));
        console.log('✓ 普通@模式解析成功\n');
    } catch (error) {
        console.log('✗ 普通@模式解析失败:', error.message, '\n');
    }

    // 测试3: 验证@@模式限制
    console.log('测试3: 验证@@模式限制（应该失败）');
    try {
        engine.validateNewSortRuleFormat('@@@CV');
        console.log('✗ 验证应该失败但没有失败\n');
    } catch (error) {
        console.log('✓ 正确捕获错误:', error.message, '\n');
    }

    // 测试4: 验证@模式位置标识符要求
    console.log('测试4: 验证@模式位置标识符要求（应该失败）');
    try {
        // 使用CV（两个单字母集合连写）来测试多级排序
        engine.validateNewSortRuleFormat('@CV'); // 这是两级排序，应该要求位置标识符
        console.log('✗ 验证应该失败但没有失败\n');
    } catch (error) {
        console.log('✓ 正确捕获错误:', error.message, '\n');
    }

    // 测试4b: 验证单级排序允许无位置标识符
    console.log('测试4b: 验证单级排序允许无位置标识符（应该成功）');
    try {
        engine.validateNewSortRuleFormat('@C');
        console.log('✓ 单级排序验证成功\n');
    } catch (error) {
        console.log('✗ 单级排序验证失败:', error.message, '\n');
    }

    // 测试5: 相邻匹配功能
    console.log('测试5: 相邻匹配功能');
    try {
        const words = ['cat', 'dog', 'bird', 'fish'];
        const sortGroups = [{ setName: 'C', positionFlag: '^', descending: false }, { setName: 'V', positionFlag: '*', descending: false }];
        const result = engine.findAdjacentMatch('cat', sortGroups, new Map());
        console.log('cat 相邻匹配结果:', JSON.stringify(result, null, 2));
        console.log('✓ 相邻匹配功能测试完成\n');
    } catch (error) {
        console.log('✗ 相邻匹配功能失败:', error.message, '\n');
    }

    console.log('=== 测试完成 ===');
}

testNewFeatures();