'use strict';
var ok = require('assert').ok;

var COMPILER_ATTRIBUTE_HANDLERS = {
    'preserve-whitespace': function(attr, context) {
        context.setPreserveWhitespace(true);
    },
    'preserve-comments': function(attr, context) {
        context.setPreserveComments(true);
    }
};

var ieConditionalCommentRegExp = /^\[if [^]*?<!\[endif\]$/;

function isIEConditionalComment(comment) {
    return ieConditionalCommentRegExp.test(comment);
}

class Parser {
    constructor(parserImpl) {
        ok(parserImpl, '"parserImpl" is required');

        this.parserImpl = parserImpl;

        this.prevTextNode = null;
        this.stack = null;

        // The context gets provided when parse is called
        // but we store it as part of the object so that the handler
        // methods have access
        this.context = null;
    }

    _reset() {
        this.prevTextNode = null;
        this.stack = [];
    }

    parse(src, context) {
        ok(typeof src === 'string', '"src" should be a string');
        ok(context, '"context" is required');

        this._reset();

        this.context = context;

        var builder = context.builder;
        var rootNode = builder.templateRoot();

        this.stack.push({
            node: rootNode
        });

        this.parserImpl.parse(src, this);

        return rootNode;
    }

    handleCharacters(text) {
        var builder = this.context.builder;

        if (this.prevTextNode && this.prevTextNode.isLiteral()) {
            this.prevTextNode.appendText(text);
        } else {
            var escape = false;
            this.prevTextNode = builder.text(builder.literal(text), escape);
            this.prevTextNode.pos = text.pos;
            this.parentNode.appendChild(this.prevTextNode);
        }
    }

    handleStartElement(el) {
        var context = this.context;
        var builder = context.builder;

        var tagName = el.tagName;
        var attributes = el.attributes;
        var argument = el.argument; // e.g. For <for(color in colors)>, argument will be "color in colors"

        if (tagName === 'compiler-options') {
            attributes.forEach(function (attr) {
                let attrName = attr.name;
                let handler = COMPILER_ATTRIBUTE_HANDLERS[attrName];

                if (!handler) {
                    context.addError({
                        code: 'ERR_INVALID_COMPILER_OPTION',
                        message: 'Invalid Marko compiler option of "' + attrName + '". Allowed: ' + Object.keys(COMPILER_ATTRIBUTE_HANDLERS).join(', '),
                        pos: el.pos,
                        node: el
                    });
                    return;
                }

                handler(attr, context);
            });

            return;
        }

        this.prevTextNode = null;

        var elDef = {
            tagName: tagName,
            argument: argument,
            openTagOnly: el.openTagOnly === true,
            selfClosed: el.selfClosed === true,
            pos: el.pos,
            attributes: attributes.map((attr) => {
                var isLiteral = false;

                if (attr.hasOwnProperty('literalValue')) {
                    isLiteral = true;
                }

                var attrDef = {
                    name: attr.name,
                    value: isLiteral ?
                        builder.literal(attr.literalValue) :
                        attr.expression == null ? undefined : builder.parseExpression(attr.expression)
                };

                if (attr.argument) {
                    attrDef.argument = attr.argument;
                }

                return attrDef;
            })
        };

        var node = this.context.createNodeForEl(elDef);

        var tagDef = node.tagDef;
        if (node.tagDef) {
            var body = tagDef.body;
            if (body) {

            }
        }

        this.parentNode.appendChild(node);

        this.stack.push({
            node: node,
            tag: null
        });
    }

    handleEndElement(elementName) {
        if (elementName === 'compiler-options') {
            return;
        }

        this.prevTextNode = null;

        this.stack.pop();
    }

    handleComment(comment) {
        this.prevTextNode = null;

        var builder = this.context.builder;

        var preserveComment = this.context.isPreserveComments() ||
            isIEConditionalComment(comment);

        if (preserveComment) {
            var commentNode = builder.htmlComment(builder.literal(comment));
            this.parentNode.appendChild(commentNode);
        }
    }

    handleBodyTextPlaceholder(expression, escape) {
        this.prevTextNode = null;
        var builder = this.context.builder;
        var parsedExpression = builder.parseExpression(expression);
        var preserveWhitespace = true;

        var text = builder.text(parsedExpression, escape, preserveWhitespace);
        this.parentNode.appendChild(text);
    }

    handleError(event) {
        this.context.addError({
            message: event.message,
            code: event.code,
            pos: event.pos,
            endPos: event.endPos
        });
    }

    get parentNode() {
        var last = this.stack[this.stack.length-1];
        return last.node;
    }

    getParserStateForTag(el) {
        var attributes = el.attributes;

        for (var i=0; i<attributes.length; i++) {
            var attr = attributes[i];
            var attrName = attr.name;
            if (attrName === 'marko-body') {
                var parseMode;

                if (attr.literalValue) {
                    parseMode = attr.literalValue;
                }

                if (parseMode === 'static-text' ||
                    parseMode === 'parsed-text' ||
                    parseMode === 'html') {
                    return parseMode;
                } else {
                    this.context.addError({
                        message: 'Value for "marko-body" should be one of the following: "static-text", "parsed-text", "html"',
                        code: 'ERR_INVALID_ATTR'
                    });
                    return;
                }
            }
        }

        var tagName = el.tagName;
        var tagDef = this.context.getTagDef(tagName);

        if (tagDef) {
            var body = tagDef.body;
            if (body) {
                return body; // 'parsed-text' | 'static-text' | 'html'
            }
        }

        return null; // Default parse state
    }
}

module.exports = Parser;