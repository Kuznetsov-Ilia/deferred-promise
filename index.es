/**
    https://gist.github.com/RubaXa/8501359
* @author RubaXa <trash@rubaxa.org>
* @license MIT
*/

export default Promise;

function noop() {}


function _then(promise, method, callback) {
  return function () {
    var args = arguments, retVal;

    /* istanbul ignore else */
    if (typeof callback === 'function') {
      //try {
        retVal = callback.apply(promise, args);
      //} catch (err) {
        /*if (DEBUG) {
          console.error(err);
          throw err;
        }
        promise.reject(err);
        return;
      }*/

      if (retVal && typeof retVal.then === 'function') {
        if (retVal.done && retVal.fail) {
          retVal.done(promise.resolve).fail(promise.reject);
        }
        else {
          retVal.then(promise.resolve, promise.reject);
        }
        return;
      } else {
        args = [retVal];
        method = 'resolve';
      }
    }

    promise[method].apply(promise, args);
  };
}


/**
 * «Обещания» поддерживают как [нативный](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 * интерфейс, так и [$.Deferred](http://api.jquery.com/category/deferred-object/).
 *
 * @class   Promise
 * @param   {Function}  [executor]
 * @returns {Promise}
 */

function Promise(executor, abort, progress) {
  var _completed = false;
  var _args;
  var _doneFn = [];
  var _failFn = [];
  var dfd = /** @lends Promise.prototype */ {
    /**
     * Добавляет обработчик, который будет вызван, когда «обещание» будет «разрешено»
     * @param  {Function}  fn  функция обработчик
     * @returns {Promise}
     */
    done: function (fn) {
      _doneFn.push(fn);
      return dfd;
    },

    /**
     * Добавляет обработчик, который будет вызван, когда «обещание» будет «отменено»
     * @param  {Function}  fn  функция обработчик
     * @returns {Promise}
     */
    fail: function (fn) {
      _failFn.push(fn);
      return dfd;
    },

    /**
     * Добавляет сразу два обработчика
     * @param   {Function}   [doneFn]   будет выполнено, когда «обещание» будет «разрешено»
     * @param   {Function}   [failFn]   или когда «обещание» будет «отменено»
     * @returns {Promise}
     */
    then: function (doneFn, failFn) {
      var promise = Promise();

      dfd
        .done(_then(promise, 'resolve', doneFn))
        .fail(_then(promise, 'reject', failFn))
      ;

      return promise;
    },

    notify: noop, // jQuery support
    abort: () => {
      _doneFn = [];
      _failFn = [];
      _completed = true;
    }, // jQuery support
    progress: progress || noop, // jQuery support
    promise: function () {
      // jQuery support
      return dfd;
    },

    /**
     * Событие по которому убиваем промис
     */
    ttl: ttl,


    /**
     * Добавить обработчик «обещаний» в независимости от выполнения
     * @param   {Function}   fn   функция обработчик
     * @returns {Promise}
     */
    always: function (fn) {
      return dfd.done(fn).fail(fn);
    },


    /**
     * «Разрешить» «обещание»
     * @method
     * @param    {*}  result
     * @returns  {Promise}
     */
    resolve: _setState(true),


    /**
     * «Отменить» «обещание»
     * @method
     * @param   {*}  result
     * @returns {Promise}
     */
    reject: _setState(false)
  };


  /**
   * @name  Promise#catch
   * @alias fail
   * @method
   */
  dfd['catch'] = function (fn) {
    return dfd.then(null, fn);
  };


  // Работеам как native Promises
  /* istanbul ignore else */
  if (typeof executor === 'function') {
    //try {
      executor(dfd.resolve, dfd.reject);
    //} catch (err) {
      /*if (DEBUG) {
        console.error(err);
        throw err;
      }*/
      /*dfd.reject(err);
    }*/
  }

  return dfd;

  function _setState(state) {

    return function () {
      if (_completed) {
        return dfd;
      }

      _args = arguments;
      _completed = true;

      // Затираем методы
      dfd.done =
      dfd.fail =
      dfd.resolve =
      dfd.reject = function () {
        return dfd;
      };

      dfd[state ? 'done' : 'fail'] = function (fn) {
        /* istanbul ignore else */
        if (typeof fn === 'function') {
          fn.apply(dfd, _args);
        }
        return dfd;
      };

      var fn,
        fns = state ? _doneFn : _failFn,
        i = 0,
        n = fns.length
      ;

      for (; i < n; i++) {
        fn = fns[i];
        /* istanbul ignore else */
        if (typeof fn === 'function') {
          fn.apply(dfd, _args);
        }
      }

      fns = _doneFn = _failFn = null;

      return dfd;
    };
  }
}

/**
 * Дождаться «разрешения» всех обещаний
 * @static
 * @memberOf Promise
 * @param    {Array} iterable  массив значений/обещаний
 * @returns  {Promise}
 */

Promise.all = function (iterable) {
  var dfd = Promise(),
    d,
    i = 0,
    n = iterable.length,
    remain = n,
    values = [],
    _fn,
    _doneFn = function (i, val) {
      (i >= 0) && (values[i] = val);

      /* istanbul ignore else */
      if (--remain <= 0) {
        dfd.resolve(values);
      }
    },
    _failFn = function (err) {
      dfd.reject([err]);
    }
  ;

  if (remain === 0) {
    _doneFn();
  }
  else {
    for (; i < n; i++) {
      d = iterable[i];

      if (d && typeof d.then === 'function') {
        _fn = _doneFn.bind(null, i); // todo: тест
        if (d.done && d.fail) {
          d.done(_fn).fail(_failFn);
        } else {
          d.then(_fn, _failFn);
        }
      }
      else {
        _doneFn(i, d);
      }
    }
  }

  return dfd;
};


/**
 * Дождаться «разрешения» всех обещаний и вернуть результат последнего
 * @static
 * @memberOf Promise
 * @param    {Array}   iterable   массив значений/обещаний
 * @returns  {Promise}
 */
Promise.race = function (iterable) {
  return Promise.all(iterable).then(function (values) {
    return values.pop();
  });
};


/**
 * Привести значение к «Обещанию»
 * @static
 * @memberOf Promise
 * @param    {*}   value    переменная или объект имеющий метод then
 * @returns  {Promise}
 */
Promise.cast = function (value) {
  var promise = Promise().resolve(value);
  return value && typeof value.then === 'function'
    ? promise.then(function () { return value; })
    : promise
  ;
};


/**
 * Вернуть «разрешенное» обещание
 * @static
 * @memberOf Promise
 * @param    {*}   value    переменная
 * @returns  {Promise}
 */
Promise.resolve = function (value) {
  return Promise().resolve(value);
};


/**
 * Вернуть «отклоненное» обещание
 * @static
 * @memberOf Promise
 * @param    {*}   value    переменная
 * @returns  {Promise}
 */
Promise.reject = function (value) {
  return Promise().reject(value);
};


/**
 * Дождаться «разрешения» всех обещаний
 * @param   {Object}  map «Ключь» => «Обещание»
 * @returns {Promise}
 */
Promise.map = function (map) {
  var array = [], key, idx = 0, results = {};

  for (key in map) {
    array.push(map[key]);
  }

  return Promise.all(array).then(function (values) {
    /* jshint -W088 */
    for (key in map) {
      results[key] = values[idx++];
    }

    return results;
  });
};

/*
  1. абортим xhr
  2. костылим View.prototype.add - помойка вызываемая при деструкторе вьюхи
  3. блокируем done/fail колбеки промиса
*/
function ttl(eventEmiter, eventName) {
  var _this = this;
  var XHR = this.XHR;
  if (eventName === 'remove' && XHR) {
    eventEmiter.add([{ remove }]);// View.prototype.add
  } else {
    eventEmiter.once(eventName, remove);
  }
  function remove() {
    _this.abort();
    if (XHR.status !== 200) {
      XHR.abort();
    }
  }
  return this;
}
