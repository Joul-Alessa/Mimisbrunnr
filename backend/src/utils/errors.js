class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}

module.exports = { HttpError, NotFoundError, BadRequestError };
