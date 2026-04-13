# make check:
# - well-formedness of YAML files

.PHONY: check
check:
	set -eu; \
	if type ruby >/dev/null 2>&1; then \
	  echo "Checking YAML files with ruby"; \
	  ruby -ryaml -e 'Dir.glob("*.yaml").sort.each { |fn| puts fn; YAML.safe_load(File.read(fn)) }; puts "OK"'; \
	elif type yq >/dev/null 2>&1; then \
	  echo "Checking YAML files with yq"; \
	  for P in *.yaml; do yq eval $$P >/dev/null; done; echo OK; \
	else \
	  echo "Error: cannot check YAML files; install either ruby or yq."; \
	  exit 1 ; \
	fi
