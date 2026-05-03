# C-008: Database test data must match cleanup scope

Backend tests that insert users must use emails ending in `@test.com`, or update
`cleanup_test_data` in the same change. Fixed external-looking domains such as
`example.com` can survive cleanup and poison later registration tests.
