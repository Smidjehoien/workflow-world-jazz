export function parse<T = any>(): TransformStream<string, T> {
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            controller.enqueue(JSON.parse(line));
          } catch (error) {
            controller.error(error);
          }
        }
      }
    },

    flush(controller) {
      if (buffer.trim()) {
        try {
          controller.enqueue(JSON.parse(buffer));
        } catch (error) {
          controller.error(error);
        }
      }
    },
  });
}

export function stringify<T = any>(): TransformStream<T, string> {
  return new TransformStream({
    transform(obj, controller) {
      controller.enqueue(`${JSON.stringify(obj)}\n`);
    },
  });
}
