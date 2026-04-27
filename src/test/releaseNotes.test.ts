import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ReleaseNotesManager } from '../releaseNotes/ReleaseNotesManager';
import type { ReleaseNotesConfig, VersionLevel } from '../releaseNotes/types';

suite('ReleaseNotesManager Test Suite', () => {
  let tempDir: string;
  let manager: ReleaseNotesManager;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-test-'));
    manager = new ReleaseNotesManager(tempDir);
  });

  teardown(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('应该创建默认配置', () => {
    const config = manager.getConfig();
    assert.strictEqual(config.version, '1.0.0');
    assert.strictEqual(config.versionLevel, 'C');
    assert.deepStrictEqual(config.chipRange, []);
    assert.deepStrictEqual(config.sdkVersions, []);
  });

  test('应该更新配置', () => {
    const updates: Partial<ReleaseNotesConfig> = {
      versionLevel: 'A' as VersionLevel,
      releaseNotes: '测试发布说明',
      chipRange: ['AC707N'],
      sdkVersion: 'v2.1.0',
      appVersion: 'v1.0.0'
    };

    manager.updateConfig(updates);
    const config = manager.getConfig();

    assert.strictEqual(config.versionLevel, 'A');
    assert.strictEqual(config.releaseNotes, '测试发布说明');
    assert.deepStrictEqual(config.chipRange, ['AC707N']);
    assert.strictEqual(config.sdkVersion, 'v2.1.0');
    assert.strictEqual(config.appVersion, 'v1.0.0');
  });

  test('应该保存配置到文件', async () => {
    manager.updateConfig({
      versionLevel: 'B' as VersionLevel,
      releaseNotes: '测试内容'
    });

    const success = await manager.save();
    assert.strictEqual(success, true);

    const configPath = path.join(tempDir, '.releasePlan', 'release-notes.json');
    assert.strictEqual(fs.existsSync(configPath), true);

    const savedContent = fs.readFileSync(configPath, 'utf-8');
    const savedConfig = JSON.parse(savedContent);
    assert.strictEqual(savedConfig.versionLevel, 'B');
    assert.strictEqual(savedConfig.releaseNotes, '测试内容');
  });

  test('应该从文件加载配置', () => {
    manager.updateConfig({
      versionLevel: 'A' as VersionLevel,
      releaseNotes: '持久化测试'
    });
    manager.save();

    const newManager = new ReleaseNotesManager(tempDir);
    const config = newManager.getConfig();

    assert.strictEqual(config.versionLevel, 'A');
    assert.strictEqual(config.releaseNotes, '持久化测试');
  });

  test('应该验证必填字段', () => {
    const result = manager.validate();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length > 0, true);
    assert.strictEqual(result.errors.some(e => e.includes('版本等级')), true);
    assert.strictEqual(result.errors.some(e => e.includes('发布说明')), true);
    assert.strictEqual(result.errors.some(e => e.includes('芯片范围')), true);
  });

  test('应该验证通过完整配置', () => {
    manager.updateConfig({
      versionLevel: 'C' as VersionLevel,
      releaseNotes: '完整的发布说明',
      chipRange: ['AC707N', 'AC708N'],
      sdkVersion: 'v2.0.0',
      appVersion: 'v1.0.0'
    });

    const result = manager.validate();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('应该导出 Markdown', () => {
    manager.updateConfig({
      versionLevel: 'A' as VersionLevel,
      releaseNotes: '## 新功能\n\n- 功能1\n- 功能2',
      chipRange: ['AC707N'],
      sdkVersions: [
        { id: '1', chip: 'AC707N', version: 'v2.1.0', remark: '稳定版' }
      ],
      sdkVersion: 'v2.1.0',
      appVersion: 'v1.0.0',
      remarks: '注意事项内容'
    });

    const markdown = manager.exportToMarkdown();

    assert.strictEqual(markdown.includes('# 发布说明'), true);
    assert.strictEqual(markdown.includes('## 版本等级'), true);
    assert.strictEqual(markdown.includes('A'), true);
    assert.strictEqual(markdown.includes('## 新功能'), true);
    assert.strictEqual(markdown.includes('AC707N'), true);
    assert.strictEqual(markdown.includes('## 注意事项'), true);
    assert.strictEqual(markdown.includes('注意事项内容'), true);
  });

  test('应该正确添加 SDK 版本', () => {
    manager.addSdkVersion({ chip: 'AC707N', version: 'v2.0.0', remark: '测试' });
    const config = manager.getConfig();
    assert.strictEqual(config.sdkVersions.length, 1);
    assert.strictEqual(config.sdkVersions[0].chip, 'AC707N');
    assert.ok(config.sdkVersions[0].id);
  });

  test('应该正确删除 SDK 版本', () => {
    manager.addSdkVersion({ chip: 'AC707N', version: 'v2.0.0', remark: '测试' });
    const id = manager.getConfig().sdkVersions[0].id;
    manager.removeSdkVersion(id);
    assert.strictEqual(manager.getConfig().sdkVersions.length, 0);
  });

  test('应该正确更新 SDK 版本', () => {
    manager.addSdkVersion({ chip: 'AC707N', version: 'v2.0.0', remark: '测试' });
    const id = manager.getConfig().sdkVersions[0].id;
    manager.updateSdkVersion(id, { version: 'v2.1.0' });
    assert.strictEqual(manager.getConfig().sdkVersions[0].version, 'v2.1.0');
  });
});
