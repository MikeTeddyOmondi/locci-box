import type { Language } from './types';

/** What the editors need per language: Monaco's mode, a file extension, and starters. */

export const MONACO_LANGUAGE: Record<Language, string> = {
	python: 'python',
	node: 'javascript',
	bash: 'shell',
	ruby: 'ruby',
	go: 'go',
	rust: 'rust',
	c: 'c',
	cpp: 'cpp'
};

export const EXTENSION: Record<Language, string> = {
	python: 'py',
	node: 'js',
	bash: 'sh',
	ruby: 'rb',
	go: 'go',
	rust: 'rs',
	c: 'c',
	cpp: 'cpp'
};

/** The language a file name means, by its extension. */
export function languageOf(name: string): Language | null {
	const ext = name.split('.').at(-1)?.toLowerCase();
	const found = (Object.entries(EXTENSION) as [Language, string][]).find(([, e]) => e === ext);
	if (found) return found[0];
	return ext === 'mjs' || ext === 'cjs' ? 'node' : ext === 'cc' || ext === 'cxx' || ext === 'hpp' ? 'cpp' : null;
}

/** A complete program per language, for a new file in the editor. */
export const HELLO: Record<Language, string> = {
	python: `def fibonacci(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
`,
	node: `const fibonacci = (n) => {
  let [a, b] = [0, 1];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
};

for (let i = 0; i < 10; i++) console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
`,
	bash: `#!/bin/bash
for i in $(seq 1 5); do
  echo "line $i from $(uname -s)"
done
`,
	ruby: `def fibonacci(n)
  a, b = 0, 1
  n.times { a, b = b, a + b }
  a
end

10.times { |i| puts "fib(#{i}) = #{fibonacci(i)}" }
`,
	go: `package main

import "fmt"

func fibonacci(n int) int {
	a, b := 0, 1
	for i := 0; i < n; i++ {
		a, b = b, a+b
	}
	return a
}

func main() {
	for i := 0; i < 10; i++ {
		fmt.Printf("fib(%d) = %d\\n", i, fibonacci(i))
	}
}
`,
	rust: `fn fibonacci(n: u64) -> u64 {
    let (mut a, mut b) = (0, 1);
    for _ in 0..n {
        (a, b) = (b, a + b);
    }
    a
}

fn main() {
    for i in 0..10 {
        println!("fib({i}) = {}", fibonacci(i));
    }
}
`,
	c: `#include <stdio.h>

long fibonacci(int n) {
  long a = 0, b = 1;
  for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
  return a;
}

int main(void) {
  for (int i = 0; i < 10; i++) printf("fib(%d) = %ld\\n", i, fibonacci(i));
  return 0;
}
`,
	cpp: `#include <print>

long fibonacci(int n) {
  long a = 0, b = 1;
  for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
  return a;
}

int main() {
  for (int i = 0; i < 10; i++) std::println("fib({}) = {}", i, fibonacci(i));
}
`
};

/**
 * The playground's two sides. They run as one program (code, then tests), so
 * for the compiled languages the tests side holds main().
 */
export const CODE_STARTER: Record<Language, string> = {
	python: `def add(a, b):
    """Add two numbers"""
    return a + b

# Test this function by writing assertions on the right
`,
	node: `function add(a, b) {
  return a + b;
}

// Test this function on the right side
module.exports = { add };
`,
	bash: `#!/bin/bash

add() {
  echo $((1 + 2))
}

add
`,
	ruby: `def add(a, b)
  a + b
end

# Test on the right side
`,
	go: `package main

import "fmt"

func add(a, b int) int {
	return a + b
}

// main() with the tests goes on the right side
`,
	rust: `fn add(a: i64, b: i64) -> i64 {
    a + b
}

// main() with the tests goes on the right side
`,
	c: `#include <stdio.h>

int add(int a, int b) {
  return a + b;
}

/* main() with the tests goes on the right side */
`,
	cpp: `#include <iostream>

int add(int a, int b) {
  return a + b;
}

// main() with the tests goes on the right side
`,
};

export const TEST_STARTER: Record<Language, string> = {
	python: `# Write assertions to test your code
assert add(2, 3) == 5
assert add(-1, -2) == -3
assert add(0, 0) == 0

print("✓ All tests passed!")
`,
	node: `console.assert(add(2, 3) === 5);
console.assert(add(-1, -2) === -3);
console.assert(add(0, 0) === 0);

console.log("✓ All tests passed!");
`,
	bash: `result=$(add)
if [ $result -eq 3 ]; then
  echo "✓ Test passed!"
else
  echo "✗ Test failed!"
fi
`,
	ruby: `raise "Test failed" unless add(2, 3) == 5
raise "Test failed" unless add(-1, -2) == -3

puts "✓ All tests passed!"
`,
	go: `func main() {
	if add(2, 3) != 5 || add(-1, -2) != -3 || add(0, 0) != 0 {
		panic("Test failed")
	}
	fmt.Println("✓ All tests passed!")
}
`,
	rust: `fn main() {
    assert_eq!(add(2, 3), 5);
    assert_eq!(add(-1, -2), -3);
    assert_eq!(add(0, 0), 0);
    println!("✓ All tests passed!");
}
`,
	c: `int main(void) {
  if (add(2, 3) != 5 || add(-1, -2) != -3 || add(0, 0) != 0) {
    puts("✗ Test failed!");
    return 1;
  }
  puts("✓ All tests passed!");
  return 0;
}
`,
	cpp: `int main() {
  if (add(2, 3) != 5 || add(-1, -2) != -3 || add(0, 0) != 0) {
    std::cout << "✗ Test failed!" << std::endl;
    return 1;
  }
  std::cout << "✓ All tests passed!" << std::endl;
}
`,
};
