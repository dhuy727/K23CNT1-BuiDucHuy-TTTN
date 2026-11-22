import axiosClient from '../api/axiosClient';

const categoryService = {
  /**
   * Lấy danh sách danh mục (kèm số lượng tệp)
   */
  getCategories: async () => {
    return await axiosClient.get('/categories');
  },

  /**
   * Tạo danh mục mới
   * @param {Object} data - { name, color, description }
   */
  createCategory: async (data) => {
    return await axiosClient.post('/categories', data);
  },

  /**
   * Cập nhật danh mục
   * @param {string} id
   * @param {Object} data - { name, color, description }
   */
  updateCategory: async (id, data) => {
    return await axiosClient.put(`/categories/${id}`, data);
  },

  /**
   * Xóa danh mục
   * @param {string} id
   */
  deleteCategory: async (id) => {
    return await axiosClient.delete(`/categories/${id}`);
  },

  /**
   * Gán danh mục cho tệp tin
   * @param {string} fileId
   * @param {string} categoryName
   */
  assignFileCategory: async (fileId, categoryName) => {
    return await axiosClient.patch(`/categories/assign/${fileId}`, { categoryName });
  }
};

export default categoryService;
