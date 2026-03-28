const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUuidParam = (paramName) => {
  return (req, res, next) => {
    if (!UUID_FORMAT_REGEX.test(req.params[paramName])) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: {
          [paramName]: `${paramName} must be a valid UUID`,
        },
      });
    }

    next();
  };
};

module.exports = {
  validateUuidParam,
};
