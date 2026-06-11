export const successResponse = (
  res: any,
  message: string,
  data?: any,
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: any,
  message: string,
  statusCode = 500
) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};