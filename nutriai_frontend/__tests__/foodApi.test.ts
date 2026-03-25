import { foodAPI } from '../utils/foodApi';

// Mock fetch for unit test isolation
const globalAny: any = global;

describe('foodAPI', () => {
  beforeEach(() => {
    globalAny.fetch = jest.fn();
  });

  it('searchProducts returns products on success', async () => {
    globalAny.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [{ id: '1', name: 'Test' }], total_count: 1, page: 1, per_page: 20 })
    });
    const res = await foodAPI.searchProducts('Test');
    expect(res.products.length).toBe(1);
    expect(res.products[0].name).toBe('Test');
  });

  it('scanProductImage returns products on success', async () => {
    globalAny.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [{ name: 'Apple', brand: null, weight_grams: 150, quantity: 1, confidence: 0.95, detection_method: 'ai' }],
        session_id: 'abc-123',
        total_products: 1,
        status: 'success'
      })
    });
    const res = await foodAPI.scanProductImage('file://test.jpg');
    expect(res.products.length).toBe(1);
    expect(res.products[0].name).toBe('Apple');
    expect(res.status).toBe('success');
  });

  it('scanProductImage throws on failure', async () => {
    globalAny.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(foodAPI.scanProductImage('file://test.jpg')).rejects.toThrow();
  });
});
