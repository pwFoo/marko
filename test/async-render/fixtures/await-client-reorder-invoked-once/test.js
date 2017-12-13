const extend = require('raptor-util/extend');
const expect = require('chai').expect;

exports.templateData = {
    outer: function (callback) {
        setTimeout(function () {
            callback(null, {});
        }, 400);
    },
    inner1: function (callback) {
        setTimeout(function () {
            callback(null, {});
        }, 500);
    },
    inner2: function (callback) {
        setTimeout(function () {
            callback(null, {});
        }, 600);
    }
};

exports.checkEvents = function (events, helpers, out) {
    // Expect that we invoked the await reorderer. If true, it was only able to
    // be invoked once.
    expect(out.global.__awaitReordererInvoked).to.equal(true);

    events = events.map(function (eventInfo) {
        var arg = extend({}, eventInfo.arg);
        expect(arg.out != null).to.equal(true);

        delete arg.out; // Not serializable
        delete arg.asyncValue; // Not serializable

        return {
            event: eventInfo.event,
            arg: arg
        };
    });

    helpers.compare(events, out.isVDOM ? '-events-vdom.json' : '-events.json');
};