pub fn process_data() {
    let data = std::fs::read_to_string("nonexistent.txt").unwrap();
    println!("{}", data);
}
