# Ruby Example for Locci Box
# This code will be executed in an isolated microVM

puts "Hello from Ruby microVM!"

# Math operations
numbers = (1..10).to_a
sum = numbers.sum
puts "Sum of 1-10: #{sum}"

# JSON output
require 'json'

data = {
  language: "ruby",
  version: RUBY_VERSION,
  platform: RUBY_PLATFORM,
  sum: sum
}

puts JSON.pretty_generate(data)

# Array operations
fruits = ["apple", "banana", "cherry"]
puts "Fruits: #{fruits.join(', ')}"

# String operations
message = "Locci Box"
puts "Reversed: #{message.reverse}"
puts "Uppercase: #{message.upcase}"

# Environment info
puts "Ruby version: #{RUBY_VERSION}"
puts "Platform: #{RUBY_PLATFORM}"

# Made with Bob
