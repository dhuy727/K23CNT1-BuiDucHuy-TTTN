import axiosClient from '../api/axiosClient';

const userService = {
  getUsers: async (params = {}) => {
    return await axiosClient.get('/users', { params });
  },

  getUserById: async (userId) => {
    return await axiosClient.get(`/users/${userId}`);
  },

  updateUser: async (userId, data) => {
    return await axiosClient.put(`/users/${userId}`, data);
  },

  deleteUser: async (userId) => {
    return await axiosClient.delete(`/users/${userId}`);
  }
};

export default userService;
