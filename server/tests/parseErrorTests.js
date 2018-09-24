"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parseError_1 = require("../src/parseError");
var chai_1 = require("chai");
require("mocha");
describe("Hello function", function () {
    it("should return hello world", function () {
        var result = parseError_1.hello();
        chai_1.expect(result).to.equal("Hello world!");
    });
});
