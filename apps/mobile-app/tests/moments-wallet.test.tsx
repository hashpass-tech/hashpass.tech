import React from 'react';
import renderer, { act } from 'react-test-renderer';
import MomentsWallet from '../components/moments/MomentsWallet';
test('Moments wallet renders empty and app credential copy', async () => { global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })) as any; let tree:any; await act(async () => { tree = renderer.create(<MomentsWallet />); }); expect(JSON.stringify(tree.toJSON())).toContain('Your Moments'); expect(JSON.stringify(tree.toJSON())).toContain('will not pay gas'); });
