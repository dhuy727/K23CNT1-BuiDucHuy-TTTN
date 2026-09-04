/**
 * Định dạng phản hồi thành công chuẩn REST API
 */
const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200, metadata = null }) => {
  const response = {
    success: true,
    statusCode,
    message,
    data
  };

  if (metadata) {
    response.metadata = metadata;
  }

  return res.status(statusCode).json(response);
};

/**
 * Định dạng phản hồi tạo mới thành công (HTTP 201)
 */
const sendCreated = (res, { data = null, message = 'Resource created successfully', metadata = null }) => {
  return sendSuccess(res, { data, message, statusCode: 201, metadata });
};

module.exports = {
  sendSuccess,
  sendCreated
};
