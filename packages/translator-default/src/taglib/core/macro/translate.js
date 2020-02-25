import { types as t } from "@marko/babel-types";
import withPreviousLocation from "../../../util/with-previous-location";

const EMPTY_ARR = [];

export function exit(path) {
  const { node } = path;
  const {
    _macroId: id,
    body: { body }
  } = node;
  const params = [t.identifier("out")].concat(node.params || EMPTY_ARR);
  const block = t.blockStatement(body);
  path.replaceWith(
    withPreviousLocation(t.functionDeclaration(id, params, block), node)
  );
}
