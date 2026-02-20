import { useState, useEffect } from "react";
import { getResources, Resource } from "../api/client";

export default function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    getResources()
      .then((res) => setResources(res.data))
      .catch(() => setResources([]));
  }, []);

  return (
    <>
      <h1 className="center_text" id="show_header">
        Resources
      </h1>
      <ul id="resource_content">
        {resources.map((resource, i) => (
          <li key={i}>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="resource_links"
              href={resource.url}
            >
              {resource.title}
            </a>
            <br />
            <p className="link_description">{resource.description}</p>
            <br />
          </li>
        ))}
      </ul>
    </>
  );
}
