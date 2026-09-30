import { describe, expect, it } from 'vitest';
import { LiveWriting } from './writing-delta';

describe('執筆中に追加した文字', () => {
  it('復元した原稿を取り込まず、その後の追記だけを一度受け取る', () => {
    const writing = new LiveWriting('残っている原稿');
    expect(writing.take()).toBe('');
    writing.update('残っている原稿。続き');
    expect(writing.take()).toBe('。続き');
    expect(writing.take()).toBe('');
    writing.update('残っている原稿。続き');
    expect(writing.take()).toBe('');
  });

  it('受信前に削除・置換した文字を送らず、現在残る文字を送る', () => {
    const writing = new LiveWriting();
    writing.update('青い花');
    writing.update('赤い花');
    writing.update('赤い');
    expect(writing.take()).toBe('赤い');
    writing.update('');
    expect(writing.take()).toBe('');
  });

  it('既に受信した文字の削除では何も返さず、再入力は新規として扱う', () => {
    const writing = new LiveWriting();
    writing.update('あいう');
    expect(writing.take()).toBe('あいう');
    writing.update('あう');
    expect(writing.take()).toBe('');
    writing.update('あいう');
    expect(writing.take()).toBe('い');
  });

  it('途中への挿入と置換は周囲の既存文字を重複して送らない', () => {
    const writing = new LiveWriting('前後');
    writing.update('前まんなか後');
    expect(writing.take()).toBe('まんなか');
    writing.update('前別の文字後');
    expect(writing.take()).toBe('別の文字');
  });

  it('複数回の離れた編集を、入力順ではなく現在の文章順にまとめる', () => {
    const writing = new LiveWriting('abcd');
    writing.update('abcYd');
    writing.update('aXbcYd');
    writing.update('aXbcZd');
    expect(writing.take()).toBe('XZ');
    writing.update('aXb!cZd');
    expect(writing.take()).toBe('!');
  });

  it('結合文字の表記差を再追加せず、絵文字を途中で分割しない', () => {
    const writing = new LiveWriting('か\u3099👩🏽‍💻');
    writing.update('が👩🏽‍💻');
    expect(writing.take()).toBe('');
    writing.update('が👩🏽‍💻🇯🇵👨‍👩‍👧‍👦');
    expect(writing.take()).toBe('🇯🇵👨‍👩‍👧‍👦');
    writing.update('が👨🏽‍💻🇯🇵👨‍👩‍👧‍👦');
    expect(writing.take()).toBe('👨🏽‍💻');
  });

  it('空白や改行も保持し、受信側が文章として扱える', () => {
    const writing = new LiveWriting('昨日');
    writing.update('昨日\n流れる 球体\t');
    expect(writing.take()).toBe('\n流れる 球体\t');
    writing.update('昨日\n流れる  球体\t');
    expect(writing.take()).toBe(' ');
  });

  it('引き継ぎや再読込でloadした原稿は、保留分も含めて再追加しない', () => {
    const writing = new LiveWriting('既存');
    writing.update('既存と保留');
    writing.load('別のタブから引き継いだ原稿');
    expect(writing.take()).toBe('');
    writing.update('別のタブから引き継いだ原稿の続き');
    expect(writing.take()).toBe('の続き');
    const reloaded = new LiveWriting('別のタブから引き継いだ原稿の続き');
    expect(reloaded.take()).toBe('');
  });

  it('長い貼り付けでも引数数の制限で失敗せず、削除分を除外する', () => {
    const writing = new LiveWriting('前');
    const pasted = 'あ'.repeat(150_000);
    writing.update(`前${pasted}後`);
    writing.update(`前${pasted}`);
    expect(writing.take()).toBe(pasted);
  });
});
