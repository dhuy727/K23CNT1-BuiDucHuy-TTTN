import axiosClient from '../api/axiosClient';

const searchService = {
  search: async (params = {}) => {
    return await axiosClient.get('/search', { params });
  },

  getSuggestions: async (keyword) => {
    return await axiosClient.get('/search/suggestions', {
      params: { q: keyword }
    });
  },

  getFiltersMetadata: async () => {
    return await axiosClient.get('/search/filters-metadata');
  }
};

export default searchService;
