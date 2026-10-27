// Every error the API returns carries a stable `code`. The apps translate the
// code (with `params`) into English or Tamil; `error` is the English fallback.
export const MESSAGES = {
  BAD_REQUEST: 'Invalid request.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You are not allowed to do this.',
  NOT_FOUND: 'Not found.',
  PHONE_INVALID: 'Enter a valid 10-digit mobile number.',
  PASSWORD_SHORT: 'Password must be at least 6 characters.',
  NAME_REQUIRED: 'Please enter a name.',
  PHONE_TAKEN: 'This mobile number is already registered.',
  LOGIN_FAILED: 'Wrong mobile number or password.',
  ACCOUNT_DISABLED: 'This account is disabled. Please contact the restaurant.',
  WRONG_PASSWORD: 'Current password is wrong.',
  TOO_MANY: 'Too many attempts. Please wait a few minutes and try again.',
  CLOSED: 'Sorry, the restaurant is not taking orders right now.',
  CART_EMPTY: 'Your cart is empty.',
  ITEM_UNAVAILABLE: '{name} is not available right now.',
  OUT_OF_STOCK: 'Only {left} left of {name}.',
  MIN_ORDER: 'Minimum order for delivery is ₹{min}.',
  ADDRESS_REQUIRED: 'Please add your address and pin it on the map.',
  OUT_OF_RANGE: 'Sorry, we deliver within {km} km. This address is {distance} km away.',
  COUPON_INVALID: 'This coupon code is not valid.',
  COUPON_EXPIRED: 'This coupon has expired.',
  COUPON_MIN: 'Add ₹{gap} more to use this coupon.',
  COUPON_USED: 'You have already used this coupon.',
  COUPON_FIRST: 'This coupon is only for your first order.',
  COUPON_LIMIT: 'This coupon has reached its limit.',
  COUPON_DELIVERY: 'This coupon works on delivery orders only.',
  CODE_TAKEN: 'A coupon with this code already exists.',
  CANNOT_CANCEL: 'This order can no longer be cancelled.',
  BAD_TRANSITION: 'This order cannot move to that status now.',
  OTP_WRONG: 'Wrong OTP. Ask the customer for their 4-digit code.',
  NOT_ASSIGNED: 'This order is not assigned to you.',
  NO_RIDER: 'No delivery partner is online right now.',
  RIDER_INACTIVE: 'This delivery partner is disabled.',
  NOT_DELIVERED: 'You can rate the order after it is delivered.',
  ALREADY_RATED: 'You have already rated this order.',
  IMAGE_INVALID: 'Upload a JPG, PNG or WebP image under 3 MB.',
  CATEGORY_NOT_EMPTY: 'Move or delete the dishes in this category first.',
  NOTHING_TO_SETTLE: 'There is no cash to settle.',
  SERVER: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  constructor(code, status = 400, params = {}) {
    super(format(MESSAGES[code] || code, params));
    this.code = code;
    this.status = status;
    this.params = params;
  }
}

export const fail = (code, status, params) => { throw new AppError(code, status, params); };

function format(text, params) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}
